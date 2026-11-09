using System.Text;
using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

public sealed class ManifestException(string code, string path, string message) : Exception($"{code} at {path}: {message}")
{
    public string Code { get; } = code;
    public string Path { get; } = path;
}

/// <summary>Validates only the deliberately bounded schema vocabulary checked by the generator.</summary>
public static class ManifestReader
{
    public const int MaxBytes = 64 * 1024;
    public const int MaxDepth = 32;
    private static readonly JsonDocument Schema = JsonDocument.Parse(ManifestContract.SchemaJson);
    private static readonly JsonSerializerOptions Options = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping, Converters = { new IntegralNumberConverter() } };
    private static void Bad(string code, string path, string message) => throw new ManifestException(code, path, message);

    public static ProjectManifest ReadFile(string path)
    {
        using var stream = File.OpenRead(path);
        if (stream.Length > MaxBytes + 3) Bad("E_SIZE", "$", "Manifest exceeds the 64 KiB limit.");
        var bytes = new byte[MaxBytes + 4]; var length = 0;
        while (length < bytes.Length)
        {
            var count = stream.Read(bytes, length, bytes.Length - length);
            if (count == 0) break;
            length += count;
        }
        if (length > MaxBytes + 3) Bad("E_SIZE", "$", "Manifest exceeds the 64 KiB limit.");
        try { return Read(new UTF8Encoding(false, true).GetString(bytes, 0, length)); }
        catch (DecoderFallbackException) { throw new ManifestException("E_JSON", "$", "Manifest must be valid UTF-8 JSON."); }
    }

    public static ProjectManifest Read(string text)
    {
        if (text.StartsWith('\uFEFF')) text = text[1..];
        if (Encoding.UTF8.GetByteCount(text) > MaxBytes) Bad("E_SIZE", "$", $"Manifest exceeds {MaxBytes} bytes.");
        JsonDocument doc;
        try { doc = JsonDocument.Parse(text, new JsonDocumentOptions { MaxDepth = 256 }); }
        catch (JsonException) { throw new ManifestException("E_JSON", "$", "Manifest is not valid JSON."); }
        using (doc)
        {
            var value = doc.RootElement;
            CheckDepth(value, 0);
            if (value.ValueKind == JsonValueKind.Object && value.TryGetProperty("projectFormatVersion", out var version) &&
                IsInteger(version) && version.GetDouble() != ManifestContract.ProjectFormatVersion)
                Bad("E_PROJECT_VERSION", "$.projectFormatVersion", $"Project format {version} is unsupported; this build reads format {ManifestContract.ProjectFormatVersion}.");
            Validate(value, Schema.RootElement, "$");
            var manifest = JsonSerializer.Deserialize<ProjectManifest>(value.GetRawText(), Options)!;
            if (CompareVersions(manifest.EngineVersion, manifest.MinimumEngineVersion) < 0)
                Bad("E_ENGINE_RANGE", "$.engineVersion", "Authored engine version cannot be older than the minimum engine version.");
            if (CompareVersions(ManifestContract.CurrentEngineVersion, manifest.MinimumEngineVersion) < 0)
                Bad("E_ENGINE_VERSION", "$.minimumEngineVersion", $"Project requires engine {manifest.MinimumEngineVersion}; this build is {ManifestContract.CurrentEngineVersion}.");
            // Mirror the TypeScript kind-specific required fields without changing legacy fixture semantics.
            var source = value.GetProperty("content");
            var kind = source.GetProperty("kind").GetString();
            var fields = kind == "legacy-phase34" ? new[] { "foundation", "town", "galleries", "vault" } : new[] { "index" };
            foreach (var field in fields)
                if (!source.TryGetProperty(field, out _)) Bad("E_REQUIRED", "$.content." + field, "Required content path is missing.");
            var ids = new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i < manifest.StartingParty.Count; i++)
                if (!ids.Add(manifest.StartingParty[i].Id)) Bad("E_REFERENCE_DUPLICATE", $"$.startingParty[{i}].id", "Actor is already in the starting party.");
            return manifest;
        }
    }

    public static string Serialize(ProjectManifest manifest)
    {
        var text = JsonSerializer.Serialize(manifest, Options) + "\n";
        if (Encoding.UTF8.GetByteCount(text) > MaxBytes)
            text = JsonSerializer.Serialize(manifest, new JsonSerializerOptions(Options) { WriteIndented = false });
        _ = Read(text);
        return text;
    }

    public static string CreateStableId(string prefix)
    {
        if (!Regex.IsMatch(prefix, @"^[a-z][a-z0-9_]{0,61}$(?![\s\S])", RegexOptions.CultureInvariant))
            Bad("E_ID_PREFIX", "$", "ID prefix must be 1–62 lowercase ASCII letters, digits or underscores, beginning with a letter.");
        return prefix + "_" + Guid.NewGuid().ToString("N");
    }

    private static bool IsInteger(JsonElement value) => value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number) && Math.Abs(number) <= 9007199254740991 && Math.Truncate(number) == number;
    private static int CompareVersions(string a, string b)
    {
        var aa = a.Split('.').Select(int.Parse).ToArray(); var bb = b.Split('.').Select(int.Parse).ToArray();
        for (var i = 0; i < 3; i++) if (aa[i] != bb[i]) return aa[i].CompareTo(bb[i]);
        return 0;
    }
    private static void CheckDepth(JsonElement value, int depth)
    {
        if (value.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array)) return;
        if (depth >= MaxDepth) Bad("E_DEPTH", "$", $"Manifest exceeds {MaxDepth} nesting levels.");
        if (value.ValueKind == JsonValueKind.Object) foreach (var property in value.EnumerateObject()) CheckDepth(property.Value, depth + 1);
        else foreach (var item in value.EnumerateArray()) CheckDepth(item, depth + 1);
    }
    private static void Validate(JsonElement value, JsonElement node, string path)
    {
        if (node.TryGetProperty("$ref", out var reference))
        {
            Validate(value, Schema.RootElement.GetProperty("$defs").GetProperty(reference.GetString()!.Split('/')[^1]), path);
            return;
        }
        var type = node.GetProperty("type").GetString();
        var matches = type switch
        {
            "object" => value.ValueKind == JsonValueKind.Object,
            "array" => value.ValueKind == JsonValueKind.Array,
            "integer" => IsInteger(value),
            "string" => value.ValueKind == JsonValueKind.String,
            "boolean" => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
            _ => false
        };
        if (!matches) Bad("E_TYPE", path, $"Expected {type}.");
        if (node.TryGetProperty("const", out var constant) && !JsonElement.DeepEquals(value, constant)) Bad("E_CONST", path, $"Expected {constant}.");
        if (node.TryGetProperty("enum", out var values) && !values.EnumerateArray().Any(v => JsonElement.DeepEquals(v, value))) Bad("E_ENUM", path, "Value is not supported.");
        if (type == "object")
        {
            if (node.TryGetProperty("required", out var required)) foreach (var field in required.EnumerateArray())
                if (!value.TryGetProperty(field.GetString()!, out _)) Bad("E_REQUIRED", path + "." + field.GetString(), "Required field is missing.");
            var properties = node.GetProperty("properties");
            foreach (var field in properties.EnumerateObject()) if (value.TryGetProperty(field.Name, out var child)) Validate(child, field.Value, path + "." + field.Name);
            if (node.TryGetProperty("additionalProperties", out var additional) && additional.ValueKind == JsonValueKind.False)
                foreach (var field in value.EnumerateObject()) if (!properties.TryGetProperty(field.Name, out _)) Bad("E_PROPERTY", path + "." + field.Name, "Unknown field.");
        }
        if (type == "string")
        {
            var text = value.GetString()!; var length = text.EnumerateRunes().Count();
            if (node.TryGetProperty("minLength", out var min) && length < min.GetInt32() || node.TryGetProperty("maxLength", out var max) && length > max.GetInt32())
                Bad("E_LENGTH", path, "String length is outside the permitted range.");
            if (node.TryGetProperty("pattern", out var pattern) && !Regex.IsMatch(text, pattern.GetString()!, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)))
                Bad("E_PATTERN", path, "Value does not match the required format.");
        }
        if (type == "integer")
        {
            var number = value.GetDouble();
            if (node.TryGetProperty("minimum", out var min) && number < min.GetDouble()) Bad("E_MINIMUM", path, $"Minimum is {min}.");
            if (node.TryGetProperty("maximum", out var max) && number > max.GetDouble()) Bad("E_MAXIMUM", path, $"Maximum is {max}.");
        }
        if (type == "array")
        {
            var items = value.EnumerateArray().ToArray();
            if (node.TryGetProperty("minItems", out var min) && items.Length < min.GetInt32() || node.TryGetProperty("maxItems", out var max) && items.Length > max.GetInt32()) Bad("E_ITEMS", path, "Array length is outside the permitted range.");
            if (node.TryGetProperty("uniqueItems", out var unique) && unique.GetBoolean())
                for (var i = 0; i < items.Length; i++) for (var j = i + 1; j < items.Length; j++)
                    if (JsonElement.DeepEquals(items[i], items[j])) Bad("E_DUPLICATE_ITEMS", path, "Duplicate array records are not permitted.");
            for (var i = 0; i < items.Length; i++) Validate(items[i], node.GetProperty("items"), $"{path}[{i}]");
        }
    }

    // JSON Schema integers include 1.0 and 1e0. System.Text.Json's default Int32 reader does not.
    private sealed class IntegralNumberConverter : JsonConverter<int>
    {
        public override int Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) => checked((int)reader.GetDouble());
        public override void Write(Utf8JsonWriter writer, int value, JsonSerializerOptions options) => writer.WriteNumberValue(value);
    }
}

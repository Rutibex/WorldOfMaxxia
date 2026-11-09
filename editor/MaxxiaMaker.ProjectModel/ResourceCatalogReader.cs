using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

public sealed record ResourceRecord(string Id, string Name, string Kind, string RelativePath, string FilePath, string? LegacyPath, bool Exists);
public sealed record ResourceCatalogDocument(string FilePath, IReadOnlyList<ResourceRecord> Resources);

/// <summary>Read-only MM05 resource contract. The catalogue is rooted at its own directory.</summary>
public static class ResourceCatalogReader
{
    private static readonly Regex SafeRelative = new(@"^(?:[A-Za-z0-9_-](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?/)*[A-Za-z0-9_-](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex Stable = new(@"^asset_[a-z0-9_]{1,89}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Dictionary<string, HashSet<string>> Extensions = new(StringComparer.Ordinal)
    {
        ["image"] = new(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg" },
        ["audio"] = new(StringComparer.OrdinalIgnoreCase) { ".wav", ".ogg", ".mp3", ".mid", ".midi" },
        ["font"] = new(StringComparer.OrdinalIgnoreCase) { ".woff", ".woff2", ".ttf" }
    };
    private static string Resolve(string root, string relative)
    {
        if (relative.Length is < 1 or > 240 || !SafeRelative.IsMatch(relative) || relative.Split('/').Any(p => p is "." or ".."))
            throw new ManifestException("E_RESOURCE_PATH", "$", "Unsafe project-relative resource path: " + relative);
        var basePath = Path.GetFullPath(root); var candidate = Path.GetFullPath(Path.Combine(basePath, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!candidate.StartsWith(basePath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new ManifestException("E_RESOURCE_PATH", "$", "Resource escapes its catalogue directory.");
        // Do not follow symlink/junction components that escape a project root.
        var walk = basePath;
        foreach (var component in relative.Split('/'))
        {
            walk = Path.Combine(walk, component);
            if (File.Exists(walk) || Directory.Exists(walk))
                if ((File.GetAttributes(walk) & FileAttributes.ReparsePoint) != 0)
                    throw new ManifestException("E_RESOURCE_PATH", "$", "Resource path includes a symbolic link or junction: " + relative);
        }
        return candidate;
    }
    public static ResourceCatalogDocument? Read(string manifestFile, ProjectManifest manifest)
    {
        if (manifest.Content.Resources is not { } relativeCatalog) return null; // earlier manifests remain valid
        var root = Path.GetDirectoryName(Path.GetFullPath(manifestFile))!;
        var file = Resolve(root, relativeCatalog);
        if (!File.Exists(file)) throw new ManifestException("E_RESOURCE_MISSING", "$.content.resources", "Resource catalogue is missing: " + file);
        if (new FileInfo(file).Length > 512 * 1024 + 3) throw new ManifestException("E_RESOURCE_SIZE", "$.content.resources", "Resource catalogue exceeds 512 KiB.");
        JsonDocument json;
        try { json = JsonDocument.Parse(File.ReadAllText(file, new UTF8Encoding(false, true))); }
        catch (Exception error) when (error is JsonException or DecoderFallbackException) { throw new ManifestException("E_RESOURCE_JSON", "$.content.resources", "Resource catalogue must be valid UTF-8 JSON."); }
        using (json)
        {
            var rootNode = json.RootElement;
            if (rootNode.ValueKind != JsonValueKind.Object || rootNode.GetProperty("format").GetString() != "maxxia-resource-catalog" || rootNode.GetProperty("version").GetInt32() != 1)
                throw new ManifestException("E_RESOURCE_FORMAT", "$", "Unsupported resource catalogue version.");
            var array = rootNode.GetProperty("resources");
            if (array.ValueKind != JsonValueKind.Array || array.GetArrayLength() > 2048)
                throw new ManifestException("E_RESOURCE_FORMAT", "$.resources", "Resource catalogue must have at most 2048 resources.");
            var ids = new HashSet<string>(StringComparer.Ordinal); var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var legacyPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var result = new List<ResourceRecord>();
            foreach (var item in array.EnumerateArray())
            {
                var id = item.GetProperty("id").GetString() ?? "";
                var kind = item.GetProperty("kind").GetString() ?? "";
                var path = item.GetProperty("path").GetString() ?? "";
                if (!Stable.IsMatch(id) || !ids.Add(id)) throw new ManifestException("E_RESOURCE_ID", "$.resources", "Invalid or repeated resource ID: " + id);
                if (!Extensions.TryGetValue(kind, out var allowed)) throw new ManifestException("E_RESOURCE_KIND", "$.resources", "Unknown resource kind: " + kind);
                if (!allowed.Contains(Path.GetExtension(path))) throw new ManifestException("E_RESOURCE_EXTENSION", "$.resources", "Invalid extension for " + kind + ": " + path);
                if (!paths.Add(path)) throw new ManifestException("E_RESOURCE_PATH_COLLISION", "$.resources", "Duplicate resource path or case-only collision: " + path);
                var full = Resolve(Path.GetDirectoryName(file)!, path);
                string? legacy = item.TryGetProperty("legacyPath", out var old) ? old.GetString() : null;
                if (legacy is not null)
                {
                    _ = Resolve(root, legacy); // safety validation only, even if legacy is a historical path
                    if (!legacyPaths.Add(legacy)) throw new ManifestException("E_RESOURCE_LEGACY_COLLISION", "$.resources", "Repeated legacy resource path: " + legacy);
                }
                var name = item.TryGetProperty("name", out var label) ? label.GetString() ?? id : id;
                if (name.Length > 160) throw new ManifestException("E_RESOURCE_NAME", "$.resources", "Resource name too long.");
                result.Add(new ResourceRecord(id, name, kind, path, full, legacy, System.IO.File.Exists(full)));
            }
            return new ResourceCatalogDocument(file, result);
        }
    }
}

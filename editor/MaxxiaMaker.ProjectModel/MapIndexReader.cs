using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

/// <summary>MM16 read-only discovery supports v1 map documents and legacy grid maps. Painting begins MM17.</summary>
public sealed record MapIndexEntry(string Id, string RelativePath, string FilePath, string DisplayName);

public static class MapIndexReader
{
    private static readonly Regex MapId = new(@"^map_[a-z0-9_]{1,91}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex Relative = new(@"^(?:[A-Za-z0-9_-](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?/)*[A-Za-z0-9_-](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static string Resolve(string baseDirectory, string path)
    {
        if (path.Length > 240 || !Relative.IsMatch(path)) throw new ManifestException("E_MAP_PATH", "$.maps", "Unsafe map path.");
        var root = Path.GetFullPath(baseDirectory);
        var full = Path.GetFullPath(Path.Combine(root, path.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new ManifestException("E_MAP_PATH", "$.maps", "Map escapes the project directory.");
        return full;
    }
    public static IReadOnlyList<MapIndexEntry> Read(string manifestFile, ProjectManifest manifest)
    {
        var root = Path.GetDirectoryName(Path.GetFullPath(manifestFile))!;
        if (manifest.Content.Kind == "legacy-phase34")
        {
            return new[] { ("map_town", manifest.Content.Town), ("map_diagnostic_galleries", manifest.Content.Galleries), ("map_resonator_vault", manifest.Content.Vault) }
                .Select(t => new MapIndexEntry(t.Item1, t.Item2!, Resolve(root, t.Item2!), t.Item1)).ToArray();
        }
        if (manifest.Content.Kind != "map-index" || manifest.Content.Index is not { } relativeIndex)
            throw new ManifestException("E_MAP_INDEX", "$.content", "A map-index project requires a map index path.");
        var indexFile = Resolve(root, relativeIndex);
        if (new FileInfo(indexFile).Length > 64 * 1024 + 3) throw new ManifestException("E_INDEX_SIZE", "$", "Map index exceeds 64 KiB.");
        using var reader = JsonDocument.Parse(File.ReadAllText(indexFile, new UTF8Encoding(false, true)));
        var value = reader.RootElement;
        if (value.ValueKind != JsonValueKind.Object || value.GetProperty("format").GetString() != "maxxia-map-index" || value.GetProperty("version").GetInt32() != 1)
            throw new ManifestException("E_MAP_INDEX", "$", "Unsupported map index version.");
        var maps = value.GetProperty("maps");
        if (maps.ValueKind != JsonValueKind.Array || maps.GetArrayLength() is < 1 or > 20)
            throw new ManifestException("E_MAP_INDEX", "$.maps", "A project needs 1–20 indexed maps.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var output = new List<MapIndexEntry>();
        var mapRoot = Path.GetDirectoryName(indexFile)!;
        foreach (var item in maps.EnumerateArray())
        {
            var id = item.GetProperty("id").GetString()!;
            var path = item.GetProperty("path").GetString()!;
            if (!MapId.IsMatch(id) || !ids.Add(id)) throw new ManifestException("E_MAP_DUPLICATE", "$.maps", "Invalid or repeated map ID: " + id);
            if (!path.EndsWith(".json", StringComparison.Ordinal) || !paths.Add(path)) throw new ManifestException("E_MAP_PATH_DUPLICATE", "$.maps", "Invalid or repeated map file: " + path);
            var full = Resolve(mapRoot, path);
            var overview = MapDocumentReader.Inspect(full);
            if (overview.Id != id) throw new ManifestException("E_MAP_ID_MISMATCH", "$.maps", "Map document ID must match its index ID: " + id);
            output.Add(new MapIndexEntry(id, path, full, overview.Name));
        }
        return output;
    }
}

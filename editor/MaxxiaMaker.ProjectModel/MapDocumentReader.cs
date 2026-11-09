using System.Text.Json;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

/// <summary>
/// MM16 read-only overview of authored map documents. Gameplay collision is validated by the
/// TypeScript engine. No C# copy of movement/combat rules is introduced.
/// </summary>
public sealed record MapDocumentOverview(string Id, string Name, int Width, int Height,
    int DoorCount, int SecretCount, int TrapCount, int PortalCount, int SceneryCount, int ArrivalCount, int EventCount, string EnvironmentId, bool Legacy);

public static class MapDocumentReader
{
    private static readonly Regex MaterialId = new(@"^[a-z][a-z0-9_]{0,63}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static JsonElement Required(JsonElement parent, string name, JsonValueKind kind)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(name, out var field) || field.ValueKind != kind)
            throw new ManifestException("E_MAP_DOCUMENT", "$." + name, "Missing or invalid map field " + name + ".");
        return field;
    }
    private static int Count(JsonElement parent, string name) => Required(parent, name, JsonValueKind.Array).GetArrayLength();
    private static int Int(JsonElement parent, string name) => Required(parent, name, JsonValueKind.Number).GetInt32();
    private static string String(JsonElement parent, string name) => Required(parent, name, JsonValueKind.String).GetString()!;
    public static MapDocumentOverview Inspect(string filename)
    {
        if (new FileInfo(filename).Length > 512 * 1024)
            throw new ManifestException("E_MAP_SIZE", "$", "Map document exceeds the 512 KiB authoring limit.");
        using var parsed = JsonDocument.Parse(File.ReadAllText(filename));
        var root = parsed.RootElement;
        var id = String(root, "id"); var name = String(root, "name");
        if (root.TryGetProperty("format", out var format))
        {
            if (format.ValueKind != JsonValueKind.String || format.GetString() != "maxxia-map" || Int(root,"version") != 1)
                throw new ManifestException("E_MAP_VERSION", "$.version", "Expected maxxia-map v1; this editor will not rewrite unknown versions.");
            var width = Int(root, "width"); var height = Int(root, "height");
            if (width is < 3 or > 64 || height is < 3 or > 64)
                throw new ManifestException("E_MAP_DIMENSIONS", "$.geometry", "Map dimensions must be 3–64 cells.");
            var geometry = Required(root,"geometry",JsonValueKind.Object);
            var rows = Required(geometry,"rows",JsonValueKind.Array);
            if (rows.GetArrayLength() != height || rows.EnumerateArray().Any(row => row.ValueKind != JsonValueKind.String || row.GetString()!.Length != width))
                throw new ManifestException("E_MAP_DIMENSIONS", "$.geometry.rows", "Geometry rows do not match declared dimensions.");
            var materials = Required(root,"materials",JsonValueKind.Object);
            foreach (var surface in new[] { "floor", "wall", "ceiling" })
            {
                var layer = Required(materials,surface,JsonValueKind.Object);
                if (!MaterialId.IsMatch(String(layer,"default")) || Count(layer,"overrides") > 4096)
                    throw new ManifestException("E_MAP_MATERIAL", "$.materials."+surface, "Invalid material layer.");
            }
            var objects = Required(root,"objects",JsonValueKind.Object);
            var arrivals = Required(root,"arrivals",JsonValueKind.Array);
            if (arrivals.GetArrayLength() is < 1 or > 64 || !arrivals.EnumerateArray().Any(a => String(a,"id") == "arrival_start"))
                throw new ManifestException("E_MAP_ARRIVAL", "$.arrivals", "Missing valid arrival_start marker.");
            var settings = Required(root,"settings",JsonValueKind.Object);
            var environment = String(settings,"environmentId");
            if (!MaterialId.IsMatch(environment)) throw new ManifestException("E_MAP_SETTINGS", "$.settings.environmentId", "Invalid environment ID.");
            return new MapDocumentOverview(id,name,width,height,Count(objects,"doors"),Count(objects,"secrets"),Count(objects,"traps"),Count(objects,"portals"),Count(root,"scenery"),arrivals.GetArrayLength(),Count(root,"events"),environment,false);
        }
        // Older MM04–15 map files can still be inspected without mutating them.
        var oldRows = Required(root,"rows",JsonValueKind.Array);
        var first = oldRows.EnumerateArray().FirstOrDefault();
        var oldWidth = first.ValueKind == JsonValueKind.String ? first.GetString()!.Length : 0;
        return new MapDocumentOverview(id,name,oldWidth,oldRows.GetArrayLength(),Count(root,"doors"),root.TryGetProperty("secrets",out var secrets)?secrets.GetArrayLength():0,root.TryGetProperty("traps",out var traps)?traps.GetArrayLength():0,root.TryGetProperty("portals",out var portals)?portals.GetArrayLength():0,Count(root,"props"),1,0,"legacy",true);
    }
}

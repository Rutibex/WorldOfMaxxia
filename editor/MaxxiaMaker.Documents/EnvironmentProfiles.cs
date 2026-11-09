using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker.Documents;

/// <summary>MM19 project environment authoring, stable material IDs and resource-backed validation.</summary>
public static class EnvironmentProfiles
{
    private static readonly Regex Id = new(@"^[a-z][a-z0-9_]{0,63}$", RegexOptions.CultureInvariant);
    private static readonly Regex Hex = new(@"^#[0-9a-fA-F]{6}$", RegexOptions.CultureInvariant);
    public static JsonObject Default() => JsonNode.Parse("""
    {"format":"maxxia-environments","version":1,"profiles":[{"id":"environment_default","name":"Default masonry","skyResourceId":null,"skyColor":"#192b35","fogColor":"#041018","fogStrength":0.095,"materials":[{"id":"material_floor_default","name":"Stone floor","surface":"floor","resourceId":null},{"id":"material_wall_default","name":"Stone wall","surface":"wall","resourceId":null},{"id":"material_ceiling_default","name":"Ceiling","surface":"ceiling","resourceId":null}]}]}
    """)!.AsObject();
    public static void Validate(JsonObject data,ResourceCatalogDocument? catalog=null)
    {
        if(data["format"]?.ToString()!="maxxia-environments"||data["version"]?.GetValue<int>()!=1)throw new InvalidOperationException("Expected maxxia-environments v1.");
        var profiles=data["profiles"]?.AsArray()??throw new InvalidOperationException("Missing profiles.");
        if(profiles.Count is <1 or >64)throw new InvalidOperationException("Use 1–64 environment profiles.");
        var profileIds=new HashSet<string>(StringComparer.Ordinal);
        var imageIds=catalog?.Resources.Where(r=>r.Kind=="image"&&r.Exists).Select(r=>r.Id).ToHashSet(StringComparer.Ordinal);
        foreach(var node in profiles)
        {
            var p=node?.AsObject()??throw new InvalidOperationException("Invalid profile.");
            var id=p["id"]?.ToString()??"";var name=p["name"]?.ToString()??"";
            if(!Id.IsMatch(id)||!profileIds.Add(id)||string.IsNullOrWhiteSpace(name)||name.Length>120||
               !Hex.IsMatch(p["skyColor"]?.ToString()??"")||!Hex.IsMatch(p["fogColor"]?.ToString()??"")||
               !double.TryParse(p["fogStrength"]?.ToString(),System.Globalization.CultureInfo.InvariantCulture,out var fog)||!double.IsFinite(fog)||fog<0||fog>0.5)
               throw new InvalidOperationException("Invalid environment profile: "+id);
            CheckImage(p["skyResourceId"],imageIds,id);
            var mats=p["materials"]?.AsArray()??throw new InvalidOperationException("Missing materials in "+id);
            if(mats.Count is <3 or >128)throw new InvalidOperationException("An environment needs 3–128 materials.");
            var matIds=new HashSet<string>(StringComparer.Ordinal);var counts=new Dictionary<string,int>{{"floor",0},{"wall",0},{"ceiling",0}};
            foreach(var item in mats)
            {
                var m=item?.AsObject()??throw new InvalidOperationException("Invalid material.");var matId=m["id"]?.ToString()??"";
                var surface=m["surface"]?.ToString()??"";var label=m["name"]?.ToString()??"";
                if(!Id.IsMatch(matId)||!matIds.Add(matId)||!counts.ContainsKey(surface)||string.IsNullOrWhiteSpace(label)||label.Length>100)throw new InvalidOperationException("Invalid material "+matId);
                counts[surface]++;CheckImage(m["resourceId"],imageIds,matId);
            }
            if(counts.Values.Any(count=>count==0))throw new InvalidOperationException("Each profile needs floor, wall and ceiling material(s).");
        }
        if(System.Text.Encoding.UTF8.GetByteCount(MapDocument.Serialize(data))>128*1024)throw new InvalidOperationException("Environment database exceeds 128 KiB.");
    }
    private static void CheckImage(JsonNode? node,HashSet<string>? allowed,string source)
    {
        if(node is null)return;var id=node.ToString();
        if(!Id.IsMatch(id)||allowed is null||!allowed.Contains(id))throw new InvalidOperationException($"{source} references a missing or non-image resource {id}.");
    }
    public static JsonObject Profile(JsonObject database,string id) => database["profiles"]!.AsArray().Select(n=>n!.AsObject()).FirstOrDefault(p=>p["id"]!.ToString()==id)
        ??throw new InvalidOperationException("Unknown environment profile: "+id);
    public static JsonArray Materials(JsonObject database,string id,string surface)=>new(Profile(database,id)["materials"]!.AsArray().Where(n=>n!["surface"]!.ToString()==surface).Select(n=>n!.DeepClone()).ToArray());
    public static void ValidateMap(JsonObject map,JsonObject database)
    {
        var id=map["settings"]!["environmentId"]!.ToString();var p=Profile(database,id);
        foreach(var surface in new[]{"floor","wall","ceiling"})
        {
            var ids=p["materials"]!.AsArray().Where(n=>n!["surface"]!.ToString()==surface).Select(n=>n!["id"]!.ToString()).ToHashSet(StringComparer.Ordinal);
            var layer=map["materials"]![surface]!;
            if(!ids.Contains(layer["default"]!.ToString())||layer["overrides"]!.AsArray().Any(n=>!ids.Contains(n!["materialId"]!.ToString())))
                throw new InvalidOperationException($"Map {map["name"]} uses a missing {surface} material in profile {id}.");
        }
    }
    public static void Paint(JsonObject map,IEnumerable<(int x,int y)> cells,string surface,string materialId)
    {
        if(surface is not ("floor" or "wall" or "ceiling"))throw new InvalidOperationException("Unknown material layer.");
        var layer=map["materials"]![surface]!;var array=layer["overrides"]!.AsArray();var rows=map["geometry"]!["rows"]!.AsArray().Select(n=>n!.ToString()).ToArray();
        foreach(var (x,y) in cells.Distinct())
        {
            if(x<0||y<0||y>=rows.Length||x>=rows[y].Length||surface=="floor"&&rows[y][x]=='#'||surface=="wall"&&rows[y][x]=='.')continue;
            for(int i=array.Count-1;i>=0;i--)if(MapDocument.Number(array[i]!,"x")==x&&MapDocument.Number(array[i]!,"y")==y)array.RemoveAt(i);
            if(materialId!=layer["default"]!.ToString())array.Add(new JsonObject{["x"]=x,["y"]=y,["materialId"]=materialId});
        }
        MapDocument.Validate(map);
    }
}

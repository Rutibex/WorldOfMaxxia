using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MaxxiaMaker.Documents;

/// <summary>Lossless JSON map editing. A gesture is committed once; invalid changes never enter history.</summary>
public sealed class MapDocument
{
    private readonly AtomicFileStore store = new(maxBytes: 512 * 1024);
    private readonly List<string> history = [];
    private int cursor;
    private string saved;
    private string? fingerprint;
    public string FilePath { get; }
    public string Text => history[cursor];
    public JsonObject Model => JsonNode.Parse(Text)!.AsObject();
    public bool IsDirty => Text != saved;
    public bool CanUndo => cursor > 0;
    public bool CanRedo => cursor + 1 < history.Count;
    public MapDocument(string path)
    {
        FilePath = Path.GetFullPath(path);
        var disk = store.Read(FilePath); fingerprint = disk.Fingerprint;
        var model = JsonNode.Parse(Encoding.UTF8.GetString(disk.Bytes).TrimStart('\uFEFF'))!.AsObject();
        Validate(model); saved = Serialize(model); history.Add(saved);
    }
    public MapDocument(string path, JsonObject model)
    {
        FilePath=Path.GetFullPath(path); Validate(model); history.Add(Serialize(model)); saved="";
    }
    public static string Serialize(JsonObject model) => model.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n";
    public bool Apply(JsonObject model)
    {
        Validate(model); var next = Serialize(model); if (next == Text) return false;
        history.RemoveRange(cursor + 1, history.Count - cursor - 1); history.Add(next); cursor++;
        if (history.Count > 100) { history.RemoveAt(0); cursor--; } return true;
    }
    public void Undo() { if (CanUndo) cursor--; }
    public void Redo() { if (CanRedo) cursor++; }
    public void Preflight() { Validate(Model); if(fingerprint is null) {if(File.Exists(FilePath))throw new IOException("New map path already exists.");} else store.CheckUnchanged(FilePath, fingerprint); }
    public void Save() { if (!IsDirty) return; Preflight(); fingerprint = store.Write(FilePath, Encoding.UTF8.GetBytes(Text), fingerprint); saved = Text; }
    public static int Number(JsonNode node, string key) => node[key]!.GetValue<int>();
    public static IEnumerable<JsonObject> Positioned(JsonObject map)
    {
        foreach (var key in new[] { "scenery", "arrivals", "events" })
            foreach (var node in map[key]!.AsArray()) yield return node!.AsObject();
        foreach (var list in map["objects"]!.AsObject())
            foreach (var node in list.Value!.AsArray()) yield return node!.AsObject();
        foreach (var layer in map["materials"]!.AsObject())
            foreach (var node in layer.Value!["overrides"]!.AsArray()) yield return node!.AsObject();
    }
    public static void Validate(JsonObject map)
    {
        if (map["format"]?.ToString() != "maxxia-map" || Number(map,"version") != 1) throw new InvalidOperationException("Geometry editing requires maxxia-map v1.");
        var w = Number(map,"width"); var h = Number(map,"height");
        if (w is < 3 or > 64 || h is < 3 or > 64) throw new InvalidOperationException("Dimensions must be 3–64.");
        var rows = map["geometry"]!["rows"]!.AsArray().Select(n => n!.GetValue<string>()).ToArray();
        if (rows.Length != h || rows.Any(r => r.Length != w || r.Any(c => c != '#' && c != '.' && c != 'D'))) throw new InvalidOperationException("Invalid geometry rows.");
        if (rows[0].Any(c => c != '#') || rows[^1].Any(c => c != '#') || rows.Any(r => r[0] != '#' || r[^1] != '#')) throw new InvalidOperationException("Keep the perimeter sealed.");
        foreach (var node in Positioned(map))
        {
            var x = Number(node,"x"); var y = Number(node,"y");
            if (x < 0 || y < 0 || x >= w || y >= h) throw new InvalidOperationException($"Resize would remove an object at {x},{y}. Move it before resizing.");
        }
        foreach (var key in new[] { "arrivals", "events" })
            foreach (var node in map[key]!.AsArray())
                if (rows[Number(node!,"y")][Number(node!,"x")] != '.') throw new InvalidOperationException("An arrival or event needs an open floor cell.");
        var arrivals = map["arrivals"]!.AsArray();
        if (arrivals.Count is < 1 or > 64 || !arrivals.Any(a=>a!["id"]?.ToString()=="arrival_start"))
            throw new InvalidOperationException("A map needs 1–64 arrivals including arrival_start.");
        var arrivalIds=new HashSet<string>(StringComparer.Ordinal);
        foreach(var arrivalNode in arrivals)
        {
            var arrival=arrivalNode!.AsObject();var id=arrival["id"]?.ToString()??"";
            if(!System.Text.RegularExpressions.Regex.IsMatch(id,@"^[a-z][a-z0-9_]{0,63}$")||!arrivalIds.Add(id)||
               string.IsNullOrWhiteSpace(arrival["name"]?.ToString())||arrival["name"]!.ToString().Length>100||
               Number(arrival,"facing") is <0 or >3)throw new InvalidOperationException("Invalid or duplicate named arrival.");
        }
        var portals=map["objects"]!["portals"]!.AsArray();
        if(portals.Count>12)throw new InvalidOperationException("A map supports at most 12 transfers.");
        var portalIds=new HashSet<string>(StringComparer.Ordinal);var portalCells=new HashSet<(int,int)>();
        foreach(var portalNode in portals)
        {
            var portal=portalNode!.AsObject();var id=portal["id"]?.ToString()??"";
            var x=Number(portal,"x");var y=Number(portal,"y");
            if(!System.Text.RegularExpressions.Regex.IsMatch(id,@"^[a-z0-9_]{1,48}$")||!portalIds.Add(id)||!portalCells.Add((x,y))||
               rows[y][x]!='.'||(portal["activation"]?.ToString() is { } a && a!="step"&&a!="interact")||
               (portal["targetArrivalId"]?.ToString() is { } targetId&&!System.Text.RegularExpressions.Regex.IsMatch(targetId,@"^[a-z][a-z0-9_]{0,63}$")))
                throw new InvalidOperationException("Invalid or duplicate transfer on a blocked square.");
        }
        var doors = map["objects"]!["doors"]!.AsArray();
        for (var y=0;y<h;y++) for(var x=0;x<w;x++)
            if (rows[y][x] == 'D' && !doors.Any(d => Number(d!,"x")==x && Number(d!,"y")==y)) throw new InvalidOperationException("Door cells require door definitions. Keep existing doors; door authoring comes later.");
        foreach (var door in doors)
            if(rows[Number(door!,"y")][Number(door!,"x")]!='D') throw new InvalidOperationException("Painting cannot remove an existing door.");
        if (Encoding.UTF8.GetByteCount(Serialize(map)) > 512*1024) throw new InvalidOperationException("Map exceeds 512 KiB.");
    }
    public static void Paint(JsonObject map, IEnumerable<(int x,int y)> cells, char brush)
    {
        var w=Number(map,"width"); var h=Number(map,"height");
        var rows=map["geometry"]!["rows"]!.AsArray();
        var protectedCells=Positioned(map).Select(n=>(Number(n,"x"),Number(n,"y"))).ToHashSet();
        foreach(var (x,y) in cells.Distinct())
        {
            if(x<=0||y<=0||x>=w-1||y>=h-1||protectedCells.Contains((x,y))) continue;
            var row=rows[y]!.GetValue<string>().ToCharArray(); if(row[x]=='D')continue; row[x]=brush; rows[y]=new string(row);
        }
    }
    public static void Resize(JsonObject map,int w,int h)
    {
        if(w is <3 or >64||h is <3 or >64)throw new InvalidOperationException("Dimensions must be 3–64.");
        if(Positioned(map).Any(n=>Number(n,"x")>=w-1||Number(n,"y")>=h-1))throw new InvalidOperationException("Resize affects placed objects or material overrides. Move them first; no objects were removed.");
        var old=map["geometry"]!["rows"]!.AsArray().Select(n=>n!.GetValue<string>()).ToArray();
        var rows=new JsonArray();
        for(var y=0;y<h;y++) {var row=new char[w];for(var x=0;x<w;x++)row[x]=x==0||y==0||x==w-1||y==h-1?'#':y<old.Length-1&&x<old[0].Length-1?old[y][x]:'.';rows.Add(new string(row));}
        map["width"]=w;map["height"]=h;map["geometry"]!["rows"]=rows;Validate(map);
    }
    public static JsonObject Create(string id,string name,int w=16,int h=16)
    {
        var map=JsonNode.Parse("""
        {"format":"maxxia-map","version":1,"id":"","name":"","width":3,"height":3,"geometry":{"rows":["###","#.#","###"]},"materials":{"floor":{"default":"material_floor_default","overrides":[]},"wall":{"default":"material_wall_default","overrides":[]},"ceiling":{"default":"material_ceiling_default","overrides":[]}},"scenery":[],"objects":{"doors":[],"secrets":[],"traps":[],"fountains":[],"portals":[]},"arrivals":[{"id":"arrival_start","name":"Start","x":1,"y":1,"facing":0}],"events":[],"settings":{"environmentId":"environment_default","notes":""}}
        """)!.AsObject();map["id"]=id;map["name"]=name;Resize(map,w,h);return map;
    }
}

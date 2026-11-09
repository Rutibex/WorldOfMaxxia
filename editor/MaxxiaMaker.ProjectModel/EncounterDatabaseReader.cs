using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace MaxxiaMaker.ProjectModel;

/// <summary>MM14 author-side validators; the TypeScript engine remains the final gameplay authority.</summary>
public static class EncounterDatabaseReader
{
    public const int MaxBytes=256*1024;
    private static readonly Regex Id=new("^[a-z][a-z0-9_]{1,79}$",RegexOptions.Compiled|RegexOptions.CultureInvariant);
    private static void Fail(string path,string message)=>throw new ManifestException("E_ENCOUNTERS",path,message);
    private static JsonObject Read(string json,string format,string key,int limit)
    {
        if(Encoding.UTF8.GetByteCount(json)>MaxBytes)Fail("$","Encounter file exceeds 256 KiB.");
        JsonObject value;
        try{value=JsonNode.Parse(json,documentOptions:new JsonDocumentOptions{MaxDepth=24})!.AsObject();}
        catch(Exception ex) when(ex is JsonException or InvalidOperationException or NullReferenceException){Fail("$","Invalid encounter JSON.");throw;}
        if(value["format"]?.ToString()!=format||value["version"]?.ToString()!="1"||value[key] is not JsonArray arr||arr.Count>limit)Fail("$",$"Expected {format} v1 with up to {limit} records.");
        return value;
    }
    private static string Text(JsonNode? n,string path,int max=100)
    {
        if(n is not JsonValue v||!v.TryGetValue<string>(out var s)||s.Length>max){Fail(path,"Expected bounded string.");return "";}return s;
    }
    private static int Number(JsonNode? n,string path,int min,int max)
    {
        if(n is not JsonValue v||!v.TryGetValue<int>(out var x)||x<min||x>max){Fail(path,$"Expected integer {min}–{max}.");return 0;}return x;
    }
    private static string Identity(JsonNode? n,string path)
    {
        var key=Text(n,path,80);if(!Id.IsMatch(key))Fail(path,"Stable ID must start with a lowercase letter and contain only letters, digits and underscores.");return key;
    }
    public static JsonObject ReadGroups(string text)
    {
        var data=Read(text,"maxxia-encounter-groups","groups",256);var ids=new HashSet<string>(StringComparer.Ordinal);
        var records=data["groups"]!.AsArray();
        for(var i=0;i<records.Count;i++)
        {
            var path=$"$.groups[{i}]";if(records[i] is not JsonObject group){Fail(path,"Group must be an object.");continue;}
            var id=Identity(group["id"],path+".id");if(!ids.Add(id))Fail(path,"Duplicate group ID.");
            if(string.IsNullOrWhiteSpace(Text(group["name"],path+".name")))Fail(path,"Group name is required.");
            if(group["boss"] is not JsonValue flag||!flag.TryGetValue<bool>(out _))Fail(path+".boss","Expected true or false.");
            if(group["musicTag"] is not null&& !Regex.IsMatch(Text(group["musicTag"],path+".musicTag",48),"^[a-z][a-z0-9_]{0,47}$"))Fail(path,"Invalid music tag.");
            if(group["members"] is not JsonArray members||members.Count is <1 or >3){Fail(path+".members","Each encounter group needs 1–3 members.");continue;}
            for(var j=0;j<members.Count;j++)
            {
                var mp=$"{path}.members[{j}]";if(members[j] is not JsonObject m){Fail(mp,"Expected member object.");continue;}
                Identity(m["kindId"],mp+".kindId");Number(m["dx"],mp+".dx",-63,63);Number(m["dy"],mp+".dy",-63,63);
            }
        }
        return data;
    }
    public static JsonObject ReadPlacements(string text)
    {
        var data=Read(text,"maxxia-encounter-placements","placements",512);var ids=new HashSet<string>(StringComparer.Ordinal);var enemyIds=new HashSet<string>(StringComparer.Ordinal);
        var records=data["placements"]!.AsArray();
        for(var i=0;i<records.Count;i++)
        {
            var path=$"$.placements[{i}]";if(records[i] is not JsonObject p){Fail(path,"Placement must be an object.");continue;}
            var id=Identity(p["id"],path+".id");if(!ids.Add(id))Fail(path,"Duplicate placement ID.");
            Identity(p["mapId"],path+".mapId");Identity(p["groupId"],path+".groupId");
            Number(p["x"],path+".x",0,63);Number(p["y"],path+".y",0,63);Number(p["triggerRange"],path+".triggerRange",1,4);
            if(p["respawn"]?.ToString() is not ("never" or "on-reentry"))Fail(path+".respawn","Select never or on-reentry.");
            if(p["enemyIds"] is not JsonArray members||members.Count is <1 or >3){Fail(path+".enemyIds","Provide 1–3 persistent enemy IDs.");continue;}
            foreach(var member in members){var instance=Identity(member,path+".enemyIds");if(!enemyIds.Add(instance))Fail(path,"Repeated enemy instance ID.");}
        }
        return data;
    }
    public static void ValidateLinks(JsonObject groups,JsonObject placements,IReadOnlyCollection<string> monsterIds,IReadOnlyCollection<MapIndexEntry> maps)
    {
        var groupRecords=groups["groups"]!.AsArray().Select(n=>n!.AsObject()).ToDictionary(n=>n["id"]!.ToString());
        var mapRecords=maps.ToDictionary(m=>m.Id);
        foreach(var g in groupRecords.Values)foreach(var member in g["members"]!.AsArray())if(!monsterIds.Contains(member!["kindId"]!.ToString()))Fail("$.groups.members","Missing monster ID: "+member["kindId"]);
        foreach(var p in placements["placements"]!.AsArray())
        {
            var path="$.placements."+p!["id"];var groupId=p["groupId"]!.ToString();var mapId=p["mapId"]!.ToString();
            if(!groupRecords.TryGetValue(groupId,out var group))Fail(path,"Missing group: "+groupId);
            if(!mapRecords.TryGetValue(mapId,out var map))Fail(path,"Missing map: "+mapId);
            if(p["enemyIds"]!.AsArray().Count!=group!["members"]!.AsArray().Count)Fail(path,"Enemy ID count must match the group's member count.");
            using var json=JsonDocument.Parse(File.ReadAllText(map!.FilePath,new UTF8Encoding(false,true)));
            var rows=(json.RootElement.TryGetProperty("geometry",out var geometry)?geometry:json.RootElement).GetProperty("rows").EnumerateArray().Select(v=>v.GetString()!).ToArray();
            var x=p["x"]!.GetValue<int>();var y=p["y"]!.GetValue<int>();
            foreach(var member in group["members"]!.AsArray())
            {
                var px=x+member!["dx"]!.GetValue<int>();var py=y+member["dy"]!.GetValue<int>();
                if(py<0||py>=rows.Length||px<0||px>=rows[py].Length||rows[py][px]!='.')Fail(path,$"Member at {px},{py} must stand on walkable floor in {mapId}.");
            }
        }
    }
}

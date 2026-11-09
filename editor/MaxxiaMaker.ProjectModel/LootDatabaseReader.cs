using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace MaxxiaMaker.ProjectModel;

/// <summary>MM15 local authoring validation; engine's TypeScript validator remains authoritative.</summary>
public static class LootDatabaseReader
{
    public const int MaxBytes=256*1024;
    private static readonly Regex StableId=new("^[a-z][a-z0-9_]{1,79}$",RegexOptions.Compiled|RegexOptions.CultureInvariant);
    private static void Fail(string path,string message)=>throw new ManifestException("E_LOOT",path,message);
    private static JsonObject Root(string text,string format,string key,int max)
    {
        if(Encoding.UTF8.GetByteCount(text)>MaxBytes)Fail("$","Loot file exceeds 256 KiB.");
        JsonObject doc;
        try{doc=JsonNode.Parse(text,documentOptions:new JsonDocumentOptions{MaxDepth=24})!.AsObject();}
        catch(Exception e) when(e is JsonException or InvalidOperationException or NullReferenceException){Fail("$","Invalid JSON document.");throw;}
        if(doc["format"]?.ToString()!=format||doc["version"]?.ToString()!="1"||doc[key] is not JsonArray rows||rows.Count>max)Fail("$",$"Require {format} version 1, with at most {max} records.");
        return doc;
    }
    private static string Text(JsonNode? value,string path,int max=100)
    {
        if(value is not JsonValue v||!v.TryGetValue<string>(out var s)||s.Length>max){Fail(path,"Expected bounded string.");return "";}return s;
    }
    private static string Id(JsonNode? value,string path)
    {var name=Text(value,path,80);if(!StableId.IsMatch(name))Fail(path,"Invalid stable ID.");return name;}
    private static int Num(JsonNode? value,string path,int min,int max)
    {
        if(value is not JsonValue v||!v.TryGetValue<int>(out var n)||n<min||n>max){Fail(path,$"Expected integer {min}–{max}.");return 0;}return n;
    }
    public static JsonObject ReadTables(string text)
    {
        var doc=Root(text,"maxxia-loot-tables","tables",256);
        if(doc["assignments"] is not JsonArray links||links.Count>512)Fail("$.assignments","Expected assignments list of at most 512.");
        var ids=new HashSet<string>(StringComparer.Ordinal);
        foreach(var row in doc["tables"]!.AsArray())
        {
            if(row is not JsonObject t){Fail("$.tables","Expected table record.");continue;}
            var id=Id(t["id"],"$.tables.id");if(!ids.Add(id))Fail("$.tables.id","Duplicate table ID.");
            if(string.IsNullOrWhiteSpace(Text(t["name"],"$.tables.name")))Fail("$.tables.name","Name is required.");
            if(t["entries"] is not JsonArray entries||entries.Count>48){Fail("$.tables.entries","Maximum 48 drops per table.");continue;}
            foreach(var entry in entries)
            {
                if(entry is not JsonObject e){Fail("$.tables.entries","Expected item entry.");continue;}
                Id(e["itemId"],"$.tables.entries.itemId");Num(e["chance"],"$.tables.entries.chance",0,100);
                var min=Num(e["min"],"$.tables.entries.min",1,20);Num(e["max"],"$.tables.entries.max",min,20);
                Num(e["memberIndex"],"$.tables.entries.memberIndex",0,2);
            }
        }
        var assigned=new HashSet<string>(StringComparer.Ordinal);
        foreach(var row in doc["assignments"]!.AsArray())
        {
            if(row is not JsonObject link){Fail("$.assignments","Expected assignment.");continue;}
            var enc=Id(link["encounterId"],"$.assignments.encounterId");var table=Id(link["tableId"],"$.assignments.tableId");
            if(!assigned.Add(enc)||!ids.Contains(table))Fail("$.assignments","Duplicate encounter or unknown table.");
        }
        return doc;
    }
    public static JsonObject ReadPickups(string text)
    {
        var doc=Root(text,"maxxia-ground-pickups","pickups",128);
        var ids=new HashSet<string>(StringComparer.Ordinal);var scenes=new HashSet<string>(StringComparer.Ordinal);var quests=new HashSet<string>(StringComparer.Ordinal);int totalEntries=0;
        foreach(var row in doc["pickups"]!.AsArray())
        {
            if(row is not JsonObject p){Fail("$.pickups","Expected pickup record.");continue;}
            var id=Id(p["id"],"$.pickups.id");if(!ids.Add(id)||id.Length>73)Fail("$.pickups","Duplicate or oversized pickup ID.");
            Id(p["mapId"],"$.pickups.mapId");Num(p["x"],"$.pickups.x",0,63);Num(p["y"],"$.pickups.y",0,63);
            if(string.IsNullOrWhiteSpace(Text(p["name"],"$.pickups.name")))Fail("$.pickups.name","Name is required.");
            Num(p["gold"],"$.pickups.gold",0,1000000);
            if(p["items"] is not JsonArray items||items.Count>24){Fail("$.pickups.items","Expected up to 24 items.");continue;}
            foreach(var item in items)
            {
                if(item is not JsonObject e){Fail("$.pickups.items","Expected item entry.");continue;}
                Id(e["itemId"],"$.pickups.items.itemId");Num(e["count"],"$.pickups.items.count",1,20);
            }
            totalEntries+=items.Count+(p["legacyQuest"] is not null?1:0)+(p["questItemId"] is not null?1:0);
            if(totalEntries>400)Fail("$.pickups","More than 400 starting ground entries.");
            if(p["questItemId"] is JsonNode quest)
            {
                var questId=Id(quest,"$.pickups.questItemId");
                if(!Regex.IsMatch(questId,"^item_quest_[a-z0-9_]{1,65}$")||!quests.Add(questId)||
                   new[]{"item_quest_cistern_key","item_quest_regulator","item_quest_tessa_ledger","item_quest_orro_tools","item_quest_nera_echo"}.Contains(questId)||p["legacyQuest"] is not null)
                    Fail("$.pickups.questItemId","Use a new non-repeated item_quest_* ID, not a legacy quest ID.");
            }
            if(p["legacyQuest"] is JsonObject q)
            {
                var scene=Id(q["sceneId"],"$.pickups.legacyQuest.sceneId");Id(q["plotId"],"$.pickups.legacyQuest.plotId");
                if(!scenes.Add(scene)||items!.Count>0||p["gold"]!.GetValue<int>()!=0)Fail("$.pickups.legacyQuest","Legacy scene is repeated or contains ordinary treasure.");
            }
        }
        return doc;
    }
    public static void ValidateLinks(JsonObject loot,JsonObject pickups,IReadOnlyCollection<string> itemIds,IReadOnlyCollection<string> encounterIds,IReadOnlyCollection<MapIndexEntry> maps)
    {
        var tableIds=loot["tables"]!.AsArray().Select(t=>t!["id"]!.ToString()).ToHashSet();
        foreach(var t in loot["tables"]!.AsArray())foreach(var e in t!["entries"]!.AsArray())
            if(!itemIds.Contains(e!["itemId"]!.ToString()))Fail("$.tables.entries","Missing item: "+e["itemId"]);
        foreach(var a in loot["assignments"]!.AsArray())
        {
            if(!encounterIds.Contains(a!["encounterId"]!.ToString())||!tableIds.Contains(a["tableId"]!.ToString()))Fail("$.assignments","Unknown encounter or table.");
        }
        var mapById=maps.ToDictionary(m=>m.Id,StringComparer.Ordinal);
        foreach(var p in pickups["pickups"]!.AsArray())
        {
            var id=p!["id"]!.ToString();var mapId=p["mapId"]!.ToString();
            if(!mapById.TryGetValue(mapId,out var map))Fail("$.pickups."+id,"Unknown map: "+mapId);
            using var json=JsonDocument.Parse(File.ReadAllText(map!.FilePath,new UTF8Encoding(false,true)));
            var rows=(json.RootElement.TryGetProperty("geometry",out var geometry)?geometry:json.RootElement).GetProperty("rows").EnumerateArray().Select(r=>r.GetString()!).ToArray();
            var x=p["x"]!.GetValue<int>();var y=p["y"]!.GetValue<int>();
            if(y>=rows.Length||x>=rows[y].Length||rows[y][x]!='.')Fail("$.pickups."+id,"Pickup must be placed on walkable floor.");
            foreach(var e in p["items"]!.AsArray())if(!itemIds.Contains(e!["itemId"]!.ToString()))Fail("$.pickups."+id,"Missing item: "+e["itemId"]);
            if(p["legacyQuest"] is JsonObject q)
            {
                var scene=q["sceneId"]!.ToString();var found=(json.RootElement.TryGetProperty("scenery",out var scenery)?scenery:json.RootElement.GetProperty("props")).EnumerateArray().Any(v=>v.GetProperty("id").GetString()==scene&&v.GetProperty("x").GetInt32()==x&&v.GetProperty("y").GetInt32()==y);
                if(!found)Fail("$.pickups."+id,"Legacy quest scene is absent at this location.");
            }
        }
    }
}

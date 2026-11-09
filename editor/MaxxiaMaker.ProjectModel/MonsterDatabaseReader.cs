using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

/// <summary>MM13 author-side validation for the bounded maxxia-monsters v1 format.</summary>
public static class MonsterDatabaseReader
{
    public const int MaxBytes=256*1024;
    public static readonly string[] Visuals=["dust_imp","stone_mite","gallery_watcher","cistern_rat","sludge_leech","pipe_goblin","bell_wraith","valve_sentinel","bell_heart"];
    public static readonly string[] DamageTypes=["physical","fire","cold","lightning","poison","arcane","holy","necrotic"];
    private static void Fail(string path,string message)=>throw new ManifestException("E_MONSTER",path,message);
    private static int Number(JsonNode? node,string path,int min,int max)
    {
        if(node is not JsonValue value||!value.TryGetValue<int>(out var n)||n<min||n>max){Fail(path,$"Must be an integer {min}–{max}.");return 0;}return n;
    }
    private static string String(JsonNode? node,string path,int max=100)
    {
        if(node is not JsonValue value||!value.TryGetValue<string>(out var text)||text.Length>max){Fail(path,"Expected bounded text.");return "";}return text;
    }
    private static bool Bool(JsonNode? node,string path)
    {
        if(node is not JsonValue value||!value.TryGetValue<bool>(out var result)){Fail(path,"Expected true or false.");return false;}return result;
    }
    public static JsonObject Read(string json)
    {
        if(Encoding.UTF8.GetByteCount(json)>MaxBytes)Fail("$","Database exceeds 256 KiB.");
        JsonObject data;
        try{data=JsonNode.Parse(json,documentOptions:new JsonDocumentOptions{MaxDepth=24})!.AsObject();}
        catch(Exception ex) when(ex is JsonException or InvalidOperationException or NullReferenceException){Fail("$","Malformed monster JSON.");throw;}
        Validate(data);return data;
    }
    public static void Validate(JsonObject data)
    {
        if(String(data["format"],"$.format")!="maxxia-monsters"||Number(data["version"],"$.version",1,1)!=1||data["monsters"] is not JsonArray records||records.Count is <1 or >256)
        {Fail("$","Require maxxia-monsters version 1 with 1–256 monsters.");return;}
        var ids=new HashSet<string>(StringComparer.Ordinal);
        for(var i=0;i<records.Count;i++)
        {
            var p=$"$.monsters[{i}]";
            if(records[i] is not JsonObject m){Fail(p,"Expected monster record.");continue;}
            var id=String(m["id"],p+".id",80);
            if(!Regex.IsMatch(id,"^[a-z][a-z0-9_]{1,79}$")||!ids.Add(id))Fail(p+".id","Invalid or duplicate stable monster ID.");
            if(string.IsNullOrWhiteSpace(String(m["name"],p+".name")))Fail(p+".name","A name is required.");
            if(String(m["symbol"],p+".symbol",8).Length<1)Fail(p+".symbol","A map symbol is required.");
            foreach(var (field,min,max) in new (string,int,int)[]{("hp",1,100000),("defense",0,200),("attack",-100,200),("speed",0,200),("xp",0,1000000),("gold",0,1000000)})Number(m[field],p+"."+field,min,max);
            var dice=String(m["damage"],p+".damage",12);
            if(!Regex.IsMatch(dice,@"^(?:[1-9]|[12][0-9])d(?:[2-9]|[1-9][0-9]|100)$|^(?:[1-9]|[1-9][0-9])$"))Fail(p+".damage","Use 1d6, 2d8, or a bounded constant.");
            if(m["attributes"] is not JsonObject stats){Fail(p+".attributes","Expected DEX, WIS and CON.");continue;}
            foreach(var key in new[]{"DEX","WIS","CON"})Number(stats[key],p+".attributes."+key,1,100);
            _=Bool(m["undead"],p+".undead");
            var visual=String(m["visualId"],p+".visualId",80);
            if(!Visuals.Contains(visual))Fail(p+".visualId","Select an existing animated enemy atlas.");
            if(String(m["aiPattern"],p+".aiPattern") is not ("standard" or "resonance"))Fail(p+".aiPattern","Unsupported special AI pattern.");
            if(m["resistances"] is not JsonObject resistances||resistances.Count>8){Fail(p+".resistances","Expected up to eight resistances.");continue;}
            foreach(var kv in resistances){if(!DamageTypes.Contains(kv.Key))Fail(p+".resistances","Unknown damage type.");Number(kv.Value,p+".resistances."+kv.Key,0,100);}
            if(m["abilities"] is not JsonArray attacks||attacks.Count is <1 or >8){Fail(p+".abilities","Expected 1–8 attacks.");continue;}
            var attackIds=new HashSet<string>(StringComparer.Ordinal);var always=false;var odd=false;var even=false;
            for(var j=0;j<attacks.Count;j++)
            {
                var path=$"{p}.abilities[{j}]";
                if(attacks[j] is not JsonObject a){Fail(path,"Expected attack definition.");continue;}
                var aid=String(a["id"],path+".id",80);
                if(!Regex.IsMatch(aid,"^[a-z][a-z0-9_]{1,79}$")||!attackIds.Add(aid))Fail(path+".id","Invalid or duplicate attack ID.");
                if(String(a["kind"],path+".kind") is not ("strike" or "spectral"))Fail(path+".kind","Unknown attack kind.");
                var when=String(a["when"],path+".when");
                if(when is not ("always" or "odd_round" or "even_round" or "hurt" or "healthy"))Fail(path+".when","Unsupported attack condition.");
                always|=when=="always";odd|=when=="odd_round";even|=when=="even_round";
                Number(a["weight"],path+".weight",1,100);Number(a["bonusDamage"],path+".bonusDamage",0,100);
            }
            if(!always&&!(odd&&even))Fail(p+".abilities","Provide an always attack or matching odd/even attacks.");
        }
    }
}

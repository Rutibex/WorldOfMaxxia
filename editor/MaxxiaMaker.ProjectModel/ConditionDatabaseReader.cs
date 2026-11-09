using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MaxxiaMaker.ProjectModel;

/// <summary>MM12 supported conditions: stable semantic IDs, editable labels and repeat policy.</summary>
public static class ConditionDatabaseReader
{
    public const int MaxBytes = 16 * 1024;
    public static readonly string[] Ids = ["poisoned", "asleep", "frightened", "cursed", "drunk", "hungry"];
    public static JsonObject Read(string json)
    {
        if (Encoding.UTF8.GetByteCount(json)>MaxBytes)throw new ManifestException("E_CONDITION_SIZE","$","Condition file exceeds 16 KiB.");
        JsonObject root;
        try { root=JsonNode.Parse(json,documentOptions:new JsonDocumentOptions{MaxDepth=16})!.AsObject(); }
        catch(Exception error) when(error is JsonException or InvalidOperationException or NullReferenceException)
        { throw new ManifestException("E_CONDITION_JSON","$","Invalid condition JSON."); }
        Validate(root);return root;
    }
    public static void Validate(JsonObject root)
    {
        if(root["format"]?.ToString()!="maxxia-conditions"||root["version"]?.ToString()!="1"||root["conditions"] is not JsonArray records||records.Count!=Ids.Length)
            throw new ManifestException("E_CONDITION","$","Require maxxia-conditions version 1 and all six conditions.");
        var seen=new HashSet<string>(StringComparer.Ordinal);
        foreach(var node in records)
        {
            if(node is not JsonObject row)throw new ManifestException("E_CONDITION","$.conditions","Expected an object.");
            var id=row["id"]?.ToString()??"";var name=row["name"]?.ToString()??"";var description=row["description"]?.ToString()??"";var policy=row["reapply"]?.ToString()??"";
            if(!Ids.Contains(id)||!seen.Add(id)||string.IsNullOrWhiteSpace(name)||name.Length>80||description.Length>500||policy is not ("replace" or "extend"))
                throw new ManifestException("E_CONDITION","$.conditions."+id,"Unsupported condition, duplicate ID, invalid text or repeat policy.");
        }
    }
}

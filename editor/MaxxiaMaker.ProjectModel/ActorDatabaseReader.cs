using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

/// <summary>Bounded MM08 actor and portrait-set format; no game rules are reimplemented here.</summary>
public static class ActorDatabaseReader
{
    public const int MaxBytes = 256 * 1024;
    private static readonly Regex HeroId = new(@"^hero_[a-z0-9_]{1,90}$", RegexOptions.CultureInvariant);
    private static readonly Regex PortraitId = new(@"^portrait_[a-z0-9_]{1,90}$", RegexOptions.CultureInvariant);
    private static readonly Regex AssetId = new(@"^asset_[a-z0-9_]{1,89}$", RegexOptions.CultureInvariant);
    public static readonly string[] Attributes = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    public static readonly string[] States = ["normal", "hurt", "afflicted", "dead"];
    public static readonly string[] EquipmentSlots = ["melee", "ranged", "body", "offhand"];
    private static void Bad(string location, string message) => throw new ManifestException("E_ACTORS", location, message);
    private static string ReadString(JsonObject node, string key, string location, int length, bool required = true)
    {
        string? text;
        try { text = node[key]?.GetValue<string>(); }
        catch (InvalidOperationException) { Bad(location + "." + key, "Expected text."); return ""; }
        if (required && string.IsNullOrWhiteSpace(text) || text is null && required || text?.Length > length) Bad(location + "." + key, "Missing or invalid text.");
        return text ?? "";
    }
    private static int Number(JsonObject node, string key, string at, int lower, int upper)
    {
        int n;
        try { n = node[key]!.GetValue<int>(); }
        catch { Bad(at + "." + key, "Expected integer."); return lower; }
        if (n < lower || n > upper) Bad(at + "." + key, $"Must be {lower}–{upper}.");
        return n;
    }
    public static JsonObject Read(string text)
    {
        if (Encoding.UTF8.GetByteCount(text) > MaxBytes) Bad("$", "Actor database exceeds 256 KiB.");
        JsonObject root;
        try { root = JsonNode.Parse(text, documentOptions: new JsonDocumentOptions { MaxDepth = 32 })?.AsObject() ?? throw new JsonException(); }
        catch (Exception e) when (e is JsonException or InvalidOperationException) { throw new ManifestException("E_ACTORS_JSON", "$", "Invalid actor database JSON."); }
        Validate(root); return root;
    }
    public static void Validate(JsonObject root)
    {
        if (root["format"]?.GetValue<string>() != "maxxia-actors" || root["version"]?.GetValue<int>() != 1) Bad("$", "Expected maxxia-actors v1.");
        if (root["actors"] is not JsonArray actors || root["portraits"] is not JsonArray portraits || root["startingParty"] is not JsonArray starters) { Bad("$", "Missing actors, portraits or startingParty array."); return; }
        if (actors.Count is < 1 or > 128 || portraits.Count is < 1 or > 128 || starters.Count is < 1 or > 6) Bad("$", "Actors and portraits must have 1–128 entries; party 1–6.");
        var portraitsSeen = new HashSet<string>(StringComparer.Ordinal);
        var oldIndexes = new HashSet<int>();
        for (var i = 0; i < portraits.Count; i++)
        {
            var path = $"$.portraits[{i}]";
            if (portraits[i] is not JsonObject p) { Bad(path, "Portrait must be an object."); continue; }
            var id = ReadString(p, "id", path, 100);
            if (!PortraitId.IsMatch(id) || !portraitsSeen.Add(id)) Bad(path + ".id", "Invalid or duplicate ID.");
            _ = ReadString(p, "name", path, 100);
            if (p["legacyIndex"] is not null && !oldIndexes.Add(Number(p, "legacyIndex", path, 0, 11))) Bad(path + ".legacyIndex", "Duplicate legacy portrait index.");
            if (p["states"] is not JsonObject states) { Bad(path + ".states", "Expected four image states."); continue; }
            foreach (var key in States)
                if (!AssetId.IsMatch(ReadString(states, key, path + ".states", 96))) Bad(path + ".states." + key, "Expected a catalogue asset ID.");
        }
        var ids = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < actors.Count; i++)
        {
            var path = $"$.actors[{i}]";
            if (actors[i] is not JsonObject a) { Bad(path, "Actor must be an object."); continue; }
            var id = ReadString(a, "id", path, 100);
            if (!HeroId.IsMatch(id) || !ids.Add(id)) Bad(path + ".id", "Invalid or duplicate actor ID.");
            var name = ReadString(a, "name", path, 24);
            if (name.Any(ch => char.IsControl(ch) || ch is '<' or '>')) Bad(path + ".name", "Invalid name character.");
            if (!portraitsSeen.Contains(ReadString(a, "portraitId", path, 100))) Bad(path + ".portraitId", "Portrait set does not exist.");
            _ = ReadString(a, "classId", path, 100);
            _ = Number(a, "portrait", path, 0, 11);
            _ = Number(a, "age", path, 1, 999);
            _ = ReadString(a, "heritage", path, 100, required: false);
            if (a["attributes"] is not JsonObject attrs || a["equipment"] is not JsonObject equip) { Bad(path, "Missing attributes or equipment."); continue; }
            foreach (var key in Attributes) _ = Number(attrs, key, path + ".attributes", 1, 18);
            if (ReadString(equip, "preferredAttack", path + ".equipment", 10) is not ("melee" or "ranged")) Bad(path + ".equipment.preferredAttack", "Choose melee or ranged.");
            foreach (var key in EquipmentSlots)
            {
                if (!equip.ContainsKey(key)) Bad(path + ".equipment." + key, "Missing equipment slot.");
                if (equip[key] is not null && !ReadString(equip, key, path + ".equipment", 100).StartsWith("item_", StringComparison.Ordinal)) Bad(path + ".equipment." + key, "Expected item ID or null.");
            }
        }
        var selected = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < starters.Count; i++)
        {
            string? id;
            try { id = starters[i]?.GetValue<string>(); } catch { id = null; }
            if (id is null || !ids.Contains(id) || !selected.Add(id)) Bad($"$.startingParty[{i}]", "Select a unique existing actor.");
        }
    }
    public static string NewActorId() => "hero_" + Guid.NewGuid().ToString("N");
}

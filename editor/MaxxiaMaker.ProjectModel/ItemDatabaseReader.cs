using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

/// <summary>MM06: typed, bounded item database with stable IDs and no code evaluation.</summary>
public static class ItemDatabaseReader
{
    private static readonly Regex IdRule = new("^item_[a-z0-9_]{1,70}$", RegexOptions.CultureInvariant);
    private static readonly Regex AssetRule = new("^asset_[a-z0-9_]{1,89}$", RegexOptions.CultureInvariant);
    private static readonly HashSet<string> Categories = ["weapons", "armor", "accessories", "misc"];
    private static readonly HashSet<string> Effects = ["none", "heal", "antidote", "wake", "courage", "light", "escape", "acid", "spark", "venom", "recall", "identify"];
    private static readonly HashSet<string> Slots = ["melee", "ranged", "body", "offhand", "accessory"];
    private static readonly HashSet<string> Weights = ["light", "medium", "heavy"];
    public const int MaxBytes = 256 * 1024;
    private static void Bad(string path, string message) => throw new ManifestException("E_ITEMS", path, message);
    public static JsonObject Read(string text)
    {
        if (System.Text.Encoding.UTF8.GetByteCount(text) > MaxBytes) Bad("$", "Item database too large.");
        JsonObject root;
        try { root = JsonNode.Parse(text, documentOptions: new JsonDocumentOptions { MaxDepth = 32 })?.AsObject() ?? throw new JsonException(); }
        catch (Exception e) when (e is JsonException or InvalidOperationException) { throw new ManifestException("E_ITEMS_JSON", "$", "Invalid items JSON document."); }
        Validate(root);
        return root;
    }
    public static void Validate(JsonObject root)
    {
        if (root["format"]?.GetValue<string>() != "maxxia-items" || root["version"]?.GetValue<int>() != 1)
            Bad("$", "Expected maxxia-items version 1.");
        if (root["items"] is not JsonArray array) { Bad("$.items", "Expected items array."); return; }
        if (array.Count > 1024) Bad("$.items", "More than 1024 records.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        for (int i = 0; i < array.Count; i++)
        {
            var path = "$.items[" + i + "]";
            if (array[i] is not JsonObject item) { Bad(path, "Item record is not an object."); continue; }
            string Required(string key, bool nullable = false)
            {
                if (!item.ContainsKey(key) || (!nullable && item[key] is null)) { Bad(path + "." + key, "Missing required field."); return ""; }
                if (item[key] is null) return "";
                try { return item[key]!.GetValue<string>(); }
                catch (Exception) { Bad(path + "." + key, "Expected string."); return ""; }
            }
            int Number(string key, int min, int max)
            {
                if (!item.ContainsKey(key) || item[key] is null) { Bad(path + "." + key, "Missing number."); return 0; }
                int n;
                try { n = item[key]!.GetValue<int>(); }
                catch (Exception) { Bad(path + "." + key, "Expected integer."); return 0; }
                if (n < min || n > max) Bad(path + "." + key, "Integer outside supported range.");
                return n;
            }
            var id = Required("id");
            if (!IdRule.IsMatch(id) || !ids.Add(id)) Bad(path + ".id", "Invalid or duplicate item ID.");
            var name = Required("name"); if (name.Length is < 1 or > 120 || string.IsNullOrWhiteSpace(name)) Bad(path + ".name", "Item name must be 1–120 characters.");
            var description = Required("description"); if (description.Length > 2000) Bad(path + ".description", "Description too long.");
            var category = Required("category"); if (!Categories.Contains(category)) Bad(path + ".category", "Unknown item category.");
            var effect = Required("effect"); if (!Effects.Contains(effect)) Bad(path + ".effect", "Unknown item effect.");
            var slot = Required("slot", true); if (slot.Length > 0 && !Slots.Contains(slot)) Bad(path + ".slot", "Unknown equipment slot.");
            var weight = Required("weight", true); if (weight.Length > 0 && !Weights.Contains(weight)) Bad(path + ".weight", "Unknown equipment weight.");
            if (category == "weapons" && slot is not ("melee" or "ranged") || category == "armor" && slot is not ("body" or "offhand") || category == "accessories" && slot != "accessory" || category == "misc" && slot != "") Bad(path + ".slot", "Slot incompatible with item category.");
            var dice = Required("dice", true); if (dice.Length > 0 && !Regex.IsMatch(dice, "^[1-9][0-9]?d(?:[1-9][0-9]?|100)$")) Bad(path + ".dice", "Expected NdN dice syntax.");
            var resistance = Required("resistance", true); if (resistance.Length > 0 && !Regex.IsMatch(resistance, "^[a-z][a-z0-9_]{0,31}$")) Bad(path + ".resistance", "Invalid resistance ID.");
            _ = Number("price", 0, 100000000); _ = Number("maxDurability", 0, 10000); _ = Number("maxCharges", 0, 10000);
            _ = Number("power", 0, 100000); _ = Number("armor", 0, 10000); _ = Number("accuracy", -1000, 1000); _ = Number("resistBonus", -100, 100);
            if (!item.ContainsKey("unique") || item["unique"] is null) Bad(path + ".unique", "Missing unique flag.");
            try { _ = item["unique"]!.GetValue<bool>(); }
            catch (Exception) { Bad(path + ".unique", "Expected boolean."); }
            if (item["equipmentTags"] is not null)
            {
                if (item["equipmentTags"] is not JsonArray tags || tags.Count > 20) Bad(path + ".equipmentTags", "Expected array of equipment tags.");
                else {
                    var seen = new HashSet<string>(StringComparer.Ordinal);
                    foreach(var tag in tags) {
                        string val; try { val = tag!.GetValue<string>(); } catch { Bad(path + ".equipmentTags", "Expected text tags."); return; }
                        if (!Regex.IsMatch(val, "^[a-z][a-z0-9_:]{0,47}$") || !seen.Add(val)) Bad(path + ".equipmentTags", "Invalid or duplicate tag.");
                    }
                }
            }
            if (item["iconResourceId"] is not null && !AssetRule.IsMatch(Required("iconResourceId"))) Bad(path + ".iconResourceId", "Invalid image resource ID.");
        }
    }
    public static string NewId() => "item_" + Guid.NewGuid().ToString("N");
}

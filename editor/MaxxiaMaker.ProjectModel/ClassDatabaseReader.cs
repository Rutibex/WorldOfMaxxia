using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace MaxxiaMaker.ProjectModel;

/// <summary>MM07 bounded, shared-format validation for editable class records.</summary>
public static class ClassDatabaseReader
{
    public const int MaxBytes = 128 * 1024;
    private static readonly HashSet<string> Abilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    public static readonly string[] EquipmentTags = ["melee:staff", "melee:dagger", "melee:mace", "melee:sword", "melee:general", "ranged", "shield", "armor:light", "armor:medium", "armor:heavy", "accessory"];
    public static readonly string[] Traits = ["martial_mastery", "device_training", "mutant_biology", "thornhide"];
    public static readonly string[] Styles = ["measured", "power", "bastion", "needle", "spark", "claws", "carapace", "standard"];
    private static void Bad(string path, string message) => throw new ManifestException("E_CLASSES", path, message);
    public static JsonObject Read(string text)
    {
        if (System.Text.Encoding.UTF8.GetByteCount(text) > MaxBytes) Bad("$", "Classes database exceeds 128 KiB.");
        JsonObject root;
        try { root = JsonNode.Parse(text, documentOptions: new JsonDocumentOptions { MaxDepth = 32 })?.AsObject() ?? throw new JsonException(); }
        catch (Exception e) when (e is JsonException or InvalidOperationException) { throw new ManifestException("E_CLASSES_JSON", "$", "Malformed classes JSON."); }
        Validate(root);
        return root;
    }
    public static void Validate(JsonObject root)
    {
        if (root["format"]?.GetValue<string>() != "maxxia-classes" || root["version"]?.GetValue<int>() != 1) Bad("$", "Expected maxxia-classes v1.");
        if (root["classes"] is not JsonArray records) { Bad("$.classes", "Expected array."); return; }
        if (records.Count is < 1 or > 128) Bad("$.classes", "Must have 1–128 classes.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < records.Count; i++)
        {
            var path = $"$.classes[{i}]";
            if (records[i] is not JsonObject record) { Bad(path, "Expected record object."); continue; }
            string Str(string key, bool nullable = false)
            {
                if (!record.ContainsKey(key) || (record[key] is null && !nullable)) { Bad(path + "." + key, "Required field missing."); return ""; }
                if (record[key] is null) return "";
                try { return record[key]!.GetValue<string>(); } catch { Bad(path + "." + key, "Expected text."); return ""; }
            }
            int Number(string key, int low, int high)
            {
                int result;
                try { result = record[key]!.GetValue<int>(); }
                catch { Bad(path + "." + key, "Expected integer."); return 0; }
                if (result < low || result > high) Bad(path + "." + key, $"Must be {low}–{high}.");
                return result;
            }
            var id = Str("id");
            if (!Regex.IsMatch(id, "^(?:class_[a-z0-9_]{1,74}|[a-z][a-z0-9_]{1,75})$") || !ids.Add(id)) Bad(path + ".id", "Invalid or duplicate class ID.");
            var name = Str("name"); if (string.IsNullOrWhiteSpace(name) || name.Length > 100) Bad(path + ".name", "Name must be 1–100 characters.");
            var role = Str("role"); if (string.IsNullOrWhiteSpace(role) || role.Length > 1500) Bad(path + ".role", "Role must be 1–1500 characters.");
            var features = Str("features"); if (features.Length > 1500) Bad(path + ".features", "Features too long.");
            if (!Abilities.Contains(Str("primary"))) Bad(path + ".primary", "Unknown ability.");
            var casting = Str("casting", true); if (casting.Length > 0 && !Abilities.Contains(casting)) Bad(path + ".casting", "Unknown casting attribute.");
            _ = Number("hpBase", 1, 500); _ = Number("hpGain", 1, 100);
            var spBase = Number("spBase", 0, 500); var spGain = Number("spGain", 0, 100); var spModifier = Number("spAttributeMultiplier", 0, 20);
            if (casting.Length == 0 && (spBase != 0 || spGain != 0 || spModifier != 0)) Bad(path + ".casting", "Noncasters cannot have SP progression.");
            List<string> Checked(string key, IReadOnlyCollection<string> allowed, int max, bool required)
            {
                if (record[key] is not JsonArray entries || entries.Count > max || (required && entries.Count == 0)) { Bad(path + "." + key, "Invalid list size."); return []; }
                var list = new List<string>();
                foreach (var raw in entries)
                {
                    string tag;
                    try { tag = raw!.GetValue<string>(); }
                    catch { Bad(path + "." + key, "List must contain strings."); return []; }
                    if (!allowed.Contains(tag) || list.Contains(tag)) Bad(path + "." + key, "Unknown or duplicate value.");
                    list.Add(tag);
                }
                return list;
            }
            _ = Checked("equipmentTags", EquipmentTags, EquipmentTags.Length, true);
            var traits = Checked("traits", Traits, Traits.Length, false);
            var styles = Checked("preparedStyles", Styles, Styles.Length, true);
            foreach (var style in styles)
            {
                var trait = style switch { "measured" or "power" or "bastion" => "martial_mastery", "needle" or "spark" => "device_training", "claws" or "carapace" => "mutant_biology", _ => "" };
                if (trait.Length > 0 && !traits.Contains(trait)) Bad(path + ".preparedStyles", "Special style requires its matching trait.");
            }
        }
    }
    public static string NewId() => "class_" + Guid.NewGuid().ToString("N");
}

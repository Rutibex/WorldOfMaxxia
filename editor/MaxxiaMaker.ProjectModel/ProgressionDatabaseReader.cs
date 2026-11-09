using System.Text.Json;
using System.Text.Json.Nodes;
namespace MaxxiaMaker.ProjectModel;
/// <summary>MM09: strict, bounded progression and prepared-combat validation.</summary>
public static class ProgressionDatabaseReader
{
    public const int MaxBytes = 64 * 1024;
    private static readonly string[] Styles = ["measured", "power", "bastion", "needle", "spark", "claws", "carapace", "standard"];
    private static readonly HashSet<string> Traits = ["martial_mastery", "device_training", "mutant_biology", "thornhide"];
    private static void Bad(string path, string message) => throw new ManifestException("E_PROGRESSION", path, message);
    public static JsonObject Read(string text)
    {
        if (System.Text.Encoding.UTF8.GetByteCount(text) > MaxBytes) Bad("$", "Progression database exceeds 64 KiB.");
        JsonObject root;
        try { root = JsonNode.Parse(text, documentOptions: new JsonDocumentOptions { MaxDepth = 32 })?.AsObject() ?? throw new JsonException(); }
        catch (Exception e) when (e is JsonException or InvalidOperationException) { throw new ManifestException("E_PROGRESSION_JSON", "$", "Malformed progression JSON."); }
        Validate(root); return root;
    }
    private static int Number(JsonNode? value, int min, int max, string path)
    {
        int n;
        try { n = value!.GetValue<int>(); }
        catch { Bad(path, "Expected integer."); return 0; }
        if (n < min || n > max) Bad(path, $"Must be {min}–{max}.");return n;
    }
    public static void Validate(JsonObject root)
    {
        if (root["format"]?.GetValue<string>() != "maxxia-progression" || Number(root["version"], 1, 1, "$.version") != 1) Bad("$", "Expected maxxia-progression v1.");
        var max = Number(root["maxLevel"], 1, 20, "$.maxLevel");
        if (root["xpThresholds"] is not JsonArray curve || curve.Count != max + 1) { Bad("$.xpThresholds", "Curve must have maxLevel + 1 entries.");return; }
        if (Number(curve[0], 0, 0, "$.xpThresholds[0]") != 0 || Number(curve[1], 0, 0, "$.xpThresholds[1]") != 0) Bad("$.xpThresholds", "Starting XP must be zero.");
        var previous = 0;
        for (var level = 2; level <= max; level++) { var xp = Number(curve[level], 1, 1_000_000_000, $"$.xpThresholds[{level}]");if (xp <= previous) Bad($"$.xpThresholds[{level}]", "XP thresholds must increase.");previous = xp; }
        _ = Number(root["trainingGoldPerLevel"], 0, 100000, "$.trainingGoldPerLevel");
        if (root["attributeMilestoneLevels"] is not JsonArray milestones) { Bad("$.attributeMilestoneLevels", "Missing milestones.");return; }
        var seenMilestones = new HashSet<int>();foreach (var n in milestones) { var level = Number(n, 2, max, "$.attributeMilestoneLevels");if (!seenMilestones.Add(level)) Bad("$.attributeMilestoneLevels", "Duplicate milestone."); }
        if (root["proficiency"] is not JsonObject proficiency) { Bad("$.proficiency", "Missing proficiency.");return; }
        _ = Number(proficiency["base"], 0, 20, "$.proficiency.base");_ = Number(proficiency["veteranLevel"], 2, 20, "$.proficiency.veteranLevel");_ = Number(proficiency["veteranBonus"], 0, 20, "$.proficiency.veteranBonus");
        var milestoneLevel = Number(root["preparedMilestoneLevel"], 2, 20, "$.preparedMilestoneLevel");_ = Number(root["preparedVeteranLevel"], milestoneLevel, 20, "$.preparedVeteranLevel");
        if (root["traitBonuses"] is not JsonObject bonus || bonus["device_training"] is not JsonObject device || bonus["thornhide"] is not JsonObject thorn) { Bad("$.traitBonuses", "Missing trait bonuses.");return; }
        foreach (var name in new[] { "rangedAccuracy", "rangedVeteranAccuracy", "rangedMilestoneDamage" }) _ = Number(device[name], 0, 20, "$.traitBonuses.device_training." + name);
        _ = Number(thorn["reflectAtMilestone"], 0, 20, "$.traitBonuses.thornhide.reflectAtMilestone");
        if (root["prepared"] is not JsonArray prepared || prepared.Count != Styles.Length) { Bad("$.prepared", "Exactly eight supported prepared styles are required.");return; }
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < prepared.Count; i++)
        {
            var path = $"$.prepared[{i}]";
            if (prepared[i] is not JsonObject style) { Bad(path, "Expected style object.");return; }
            var id = style["id"]?.GetValue<string>() ?? "";
            if (!Styles.Contains(id) || !seen.Add(id)) Bad(path + ".id", "Unknown or duplicate style.");
            var name = style["name"]?.GetValue<string>() ?? "";if (string.IsNullOrWhiteSpace(name) || name.Length > 100) Bad(path + ".name", "Name must be 1–100 characters.");
            var op = style["operation"]?.GetValue<string>() ?? "";var trait = style["requiredTrait"]?.GetValue<string>();
            if (!(new[] { "weapon", "device", "natural" }).Contains(op) || (trait is not null && !Traits.Contains(trait)) || (op == "device" && trait != "device_training") || (op == "natural" && trait != "mutant_biology") || (id == "standard" && trait is not null)) Bad(path + ".operation", "Unsupported operation/trait pairing.");
            if (!(new[] { "physical", "lightning" }).Contains(style["damageType"]?.GetValue<string>() ?? "")) Bad(path + ".damageType", "Unsupported damage type.");
            foreach (var key in new[] { "attackBonus", "attackBonusAtVeteran", "damageBonus", "damageBonusAtMilestone", "ignoreDefense", "defenseBonus", "defenseAtVeteran" }) _ = Number(style[key], key == "attackBonus" ? -20 : 0, 20, path + "." + key);
            if (style["damageBonusAtMilestoneReplacesBase"] is not JsonValue b || !b.TryGetValue<bool>(out _)) Bad(path + ".damageBonusAtMilestoneReplacesBase", "Expected boolean.");
            foreach (var key in new[] { "dice", "diceAtMilestone", "diceAtVeteran" })
            {
                var raw = style[key];if (raw is null && key != "dice") continue;
                string dice;try { dice = raw!.GetValue<string>(); } catch { Bad(path + "." + key, "Invalid dice.");return; }
                if (!System.Text.RegularExpressions.Regex.IsMatch(dice, "^(?:[1-9][0-9]?d(?:4|6|8|10|12|20)|[1-9][0-9]?)$")) Bad(path + "." + key, "Invalid or unsafe dice notation.");
            }
        }
    }
}

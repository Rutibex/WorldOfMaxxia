using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace MaxxiaMaker.ProjectModel;
/// <summary>MM10: bounded spell records, supported existing behaviors, and class learning lists.</summary>
public static class SpellDatabaseReader
{
    public const int MaxBytes = 256 * 1024;
    public static readonly string[] Targets = ["enemy", "enemies", "ally", "dead_ally", "party", "world", "object"];
    public static readonly string[] Contexts = ["combat", "exploration", "both"];
    public static readonly string[] Effects = ["damage", "heal", "light", "attack_debuff", "bind", "reveal", "unseal", "ward", "fold", "cure", "steadfast", "chorus", "turn_undead", "break_curse", "revive", "hints", "leech", "sleep", "secret", "bones", "briar", "echo", "hearth", "composed"];
    private static readonly Dictionary<string,(string Effect,string Target,string Context)> Behavior = new(StringComparer.Ordinal)
    {
        ["spell_wizard_spark_lance"] = ("damage","enemy","combat"),        ["spell_wizard_lantern_globe"] = ("light","party","exploration"),        ["spell_wizard_frost_needle"] = ("damage","enemy","combat"),        ["spell_wizard_burning_fan"] = ("damage","enemies","combat"),        ["spell_wizard_glass_eye"] = ("reveal","world","exploration"),        ["spell_wizard_binding_thread"] = ("bind","enemy","combat"),        ["spell_wizard_storm_arc"] = ("damage","enemies","combat"),        ["spell_wizard_unseal"] = ("unseal","object","exploration"),        ["spell_wizard_stone_skin"] = ("ward","party","both"),        ["spell_wizard_fold_step"] = ("fold","world","exploration"),        ["spell_wizard_mirror_ward"] = ("ward","party","both"),        ["spell_wizard_starfall"] = ("damage","enemies","combat"),        ["spell_priest_mend_flesh"] = ("heal","ally","both"),        ["spell_priest_sacred_ember"] = ("damage","enemy","combat"),        ["spell_priest_pilgrim_light"] = ("light","party","exploration"),        ["spell_priest_cleanse_venom"] = ("cure","ally","both"),        ["spell_priest_steadfast"] = ("steadfast","party","both"),        ["spell_priest_blessing"] = ("ward","party","both"),        ["spell_priest_healing_chorus"] = ("chorus","party","both"),        ["spell_priest_turn_the_hollow"] = ("turn_undead","enemies","combat"),        ["spell_priest_sheltering_hand"] = ("ward","party","both"),        ["spell_priest_break_malison"] = ("break_curse","ally","both"),        ["spell_priest_return_breath"] = ("revive","dead_ally","exploration"),        ["spell_priest_dawn_judgment"] = ("damage","enemies","combat"),        ["spell_witch_withering_word"] = ("damage","enemy","combat"),        ["spell_witch_ill_omen"] = ("attack_debuff","enemy","combat"),        ["spell_witch_borrowed_face"] = ("hints","party","exploration"),        ["spell_witch_leech_kiss"] = ("leech","enemy","combat"),        ["spell_witch_sleep_of_thorns"] = ("sleep","enemy","combat"),        ["spell_witch_rat_whisper"] = ("secret","world","exploration"),        ["spell_witch_crooked_bones"] = ("bones","enemy","combat"),        ["spell_witch_briar_mantle"] = ("briar","party","both"),        ["spell_witch_malice_rain"] = ("damage","enemies","combat"),        ["spell_witch_bottle_the_echo"] = ("echo","enemy","combat"),        ["spell_witch_hearth_thread"] = ("hearth","party","exploration"),        ["spell_witch_black_moon"] = ("damage","enemies","combat")
    };
    private static readonly string[] Saves = ["DEX", "WIS", "CON"];
    private static readonly string[] Bonuses = ["INT", "WIS", "CHA"];
    private static void Bad(string path, string message) => throw new ManifestException("E_SPELL", path, message);
    private static string Str(JsonNode? node, string path, int max = 2000, bool required = false)
    {
        string value;
        try { value = node?.GetValue<string>() ?? ""; } catch { Bad(path, "Expected text.");return ""; }
        if (value.Length > max || required && string.IsNullOrWhiteSpace(value)) Bad(path, "Invalid text length.");return value;
    }
    private static int Num(JsonNode? node, string path, int min, int max)
    {
        int value;try { value = node!.GetValue<int>(); } catch { Bad(path, "Expected integer.");return 0; }
        if (value < min || value > max) Bad(path, $"Expected {min}–{max}.");return value;
    }
    public static JsonObject Read(string input)
    {
        if (Encoding.UTF8.GetByteCount(input) > MaxBytes) Bad("$", "Spell database exceeds 256 KiB.");
        JsonObject root;try { root = JsonNode.Parse(input, documentOptions: new JsonDocumentOptions { MaxDepth = 32 })?.AsObject() ?? throw new JsonException(); }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException) {throw new ManifestException("E_SPELL_JSON", "$", "Malformed spells JSON.");}
        Validate(root);return root;
    }
    public static void Validate(JsonObject root)
    {
        if (Str(root["format"], "$.format") != "maxxia-spells" || Num(root["version"], "$.version", 1, 1) != 1) Bad("$", "Expected maxxia-spells v1.");
        if (root["spells"] is not JsonArray spells || spells.Count is < 1 or > 256 || root["classAccess"] is not JsonObject access) { Bad("$", "Expected 1–256 spell entries and classAccess.");return; }
        if(root["conditionsFile"] is not null)
        {
            var filename=Str(root["conditionsFile"],"$.conditionsFile",100,true);
            if(!Regex.IsMatch(filename,"^[a-z][a-z0-9_-]*\\.json$"))Bad("$.conditionsFile","Expected a safe JSON basename.");
        }
        var ids = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < spells.Count; i++)
        {
            var p = $"$.spells[{i}]";
            if (spells[i] is not JsonObject item) { Bad(p, "Expected a spell object.");continue; }
            var id = Str(item["id"], p + ".id", 100, true);
            if (!Regex.IsMatch(id, "^[a-z][a-z0-9_]{1,100}$") || !ids.Add(id)) Bad(p + ".id", "Invalid or duplicate ID.");
            _ = Str(item["name"], p + ".name", 100, true);_ = Str(item["description"], p + ".description");
            var primary = Str(item["classId"], p + ".classId", 100, true);
            if (!Regex.IsMatch(primary, "^[a-z][a-z0-9_]{1,100}$")) Bad(p + ".classId", "Invalid class ID.");
            _ = Num(item["level"], p + ".level", 1, 20);_ = Num(item["sp"], p + ".sp", 0, 999);
            var target = Str(item["target"], p + ".target");var context = Str(item["context"], p + ".context");var effect = Str(item["effect"], p + ".effect");
            if (!Targets.Contains(target) || !Contexts.Contains(context) || !Effects.Contains(effect)) Bad(p, "Unsupported target, context or effect.");
            var behavior = Str(item["behaviorKey"], p + ".behaviorKey", 100, true);
            if (effect == "composed")
            {
                if (behavior != "composed") Bad(p + ".behaviorKey", "Composed spells require composed handler key.");
                if (item["effects"] is not JsonArray primitives || primitives.Count is < 1 or > 8) Bad(p + ".effects", "Expected 1–8 effect primitives.");
                else
                {
                    int rolls = 0;
                    for (var j=0;j<primitives.Count;j++)
                    {
                        var ep=$"{p}.effects[{j}]";
                        if(primitives[j] is not JsonObject primitive) { Bad(ep,"Expected primitive object."); continue; }
                        var op=Str(primitive["operation"],ep+".operation");var selected=Str(primitive["target"],ep+".target");
                        bool offensive=op is "damage" or "hex", world=op is "reveal" or "unseal" or "fold";
                        if(!new[]{"damage","heal","resource","condition","cure","revive","ward","hex","reveal","unseal","fold"}.Contains(op)||!new[]{"selected","caster","party","enemies"}.Contains(selected))Bad(ep,"Unsupported operation or recipient.");
                        if(world)
                        {if(selected!="caster"||target is not ("world" or "object")||context!="exploration")Bad(ep,"World effects require caster recipient, exploration context and world/object spell target.");}
                        else if(op=="revive")
                        {if(selected!="selected"||target!="dead_ally"||context!="exploration")Bad(ep,"Revive needs a selected fallen ally in exploration.");}
                        else if(offensive)
                        {if(selected=="enemies"?target!="enemies":selected!="selected"||target!="enemy")Bad(ep,"Offensive effects need an enemy or enemy group.");}
                        else if(op=="ward")
                        {if(selected is not ("caster" or "party")||target is not ("ally" or "party"))Bad(ep,"Ward recipient must be caster/party on ally/party spells.");}
                        else if(selected=="enemies"||selected=="selected"&&target!="ally")Bad(ep,"This effect targets living allies.");
                        bool noAmount=op is "condition" or "cure" or "revive" or "ward" or "hex" or "reveal" or "unseal" or "fold";
                        if(noAmount)
                        {if(primitive.ContainsKey("amount"))Bad(ep,"This effect cannot include an amount.");}
                        else rolls+=EffectExpressionReader.Validate(Str(primitive["amount"],ep+".amount",120,true),ep+".amount");
                        if(op=="resource")
                        {if(!new[]{"hp","sp"}.Contains(Str(primitive["resource"],ep+".resource")))Bad(ep,"Resource must be HP/SP.");}
                        else if(primitive.ContainsKey("resource"))Bad(ep,"Unexpected resource.");
                        if(op=="damage")
                        {if(primitive["damageType"] is not null&&!new[]{"physical","fire","cold","lightning","poison","arcane","holy","necrotic"}.Contains(Str(primitive["damageType"],ep+".damageType")))Bad(ep,"Unsupported damage family.");}
                        else if(primitive.ContainsKey("damageType"))Bad(ep,"Unexpected damage family.");
                        if(op is "condition" or "cure")
                        {if(!new[]{"poisoned","asleep","frightened","cursed","drunk","hungry"}.Contains(Str(primitive["conditionId"],ep+".conditionId")))Bad(ep,"Unknown condition ID.");}
                        else if(primitive.ContainsKey("conditionId"))Bad(ep,"Unexpected condition ID.");
                        if(op=="ward")
                        {if(!new[]{"stone_skin","mirror_ward","blessing","sheltering_hand","steadfast","briar_mantle","light","glass_eye","borrowed_face"}.Contains(Str(primitive["wardKind"],ep+".wardKind")))Bad(ep,"Unsupported ward.");}
                        else if(primitive.ContainsKey("wardKind"))Bad(ep,"Unexpected ward.");
                        if(op=="hex")
                        {if(!new[]{"ill_omen","binding_thread","sleep_thorns","crooked_bones","bottle_echo","hollow_fear"}.Contains(Str(primitive["hexKind"],ep+".hexKind")))Bad(ep,"Unsupported hex.");}
                        else if(primitive.ContainsKey("hexKind"))Bad(ep,"Unexpected hex.");
                        if(op is "condition" or "ward" or "hex" or "reveal")
                        {
                            var unit=Str(primitive["unit"],ep+".unit");
                            if(!new[]{"ticks","turns","minutes","persistent"}.Contains(unit)||op!="condition"&&unit!=(op=="hex"?"turns":"minutes"))Bad(ep,"Unsupported duration unit.");
                            var kind=op=="hex"?Str(primitive["hexKind"],ep+".hexKind"):op=="ward"?Str(primitive["wardKind"],ep+".wardKind"):"";
                            var max=op=="hex"?(kind is "ill_omen" or "crooked_bones"?3:kind is "bottle_echo" or "hollow_fear"?2:1):op=="ward"?(kind=="light"?60:kind=="briar_mantle"?5:kind=="steadfast"?3:30):op=="reveal"?30:999;
                            if(unit=="persistent")
                            {if(op!="condition"||!primitive.ContainsKey("remaining")||primitive["remaining"] is not null)Bad(ep,"Only a condition can be persistent, with null duration.");}
                            else _=Num(primitive["remaining"],ep+".remaining",1,max);
                        }
                        else if(primitive.ContainsKey("unit")||primitive.ContainsKey("remaining"))Bad(ep,"Unexpected duration.");
                    }
                    if(rolls>48)Bad(p+".effects","Combined roll budget exceeds 48 dice rolls.");
                }
            }
            else
            {
                if (!Behavior.TryGetValue(behavior, out var original)) Bad(p + ".behaviorKey", "Unsupported handler key.");
                else if (effect != original.Effect || target != original.Target || context != original.Context) Bad(p, "Handler requires matching target, context and effect.");
                if(item.ContainsKey("effects"))Bad(p+".effects","Only composed spells may carry primitives.");
            }
            foreach (var key in new[] { "bonus", "save", "damageType", "dice" }) if (item[key] is not null)
            {
                var text = Str(item[key], p + "." + key, 60);
                if (key == "bonus" && !Bonuses.Contains(text) || key == "save" && !Saves.Contains(text) || key == "dice" && !Regex.IsMatch(text, "^(?:[1-9]|[12][0-9])d(?:4|6|8|10|12|20)$") || key == "damageType" && !Regex.IsMatch(text, "^[a-z_]{1,30}$")) Bad(p + "." + key, "Invalid optional property.");
            }
            if (item["duration"] is not null) _ = Num(item["duration"], p + ".duration", 0, 10000);
            if (item["saveHalf"] is not null) try { _ = item["saveHalf"]!.GetValue<bool>(); } catch { Bad(p + ".saveHalf", "Expected boolean."); }
        }
        if (access.Count > 128) Bad("$.classAccess", "Too many casting classes.");
        foreach (var (key, entry) in access)
        {
            var p = "$.classAccess." + key;
            if (!Regex.IsMatch(key, "^[a-z][a-z0-9_]{1,100}$") || entry is not JsonObject o || o["spellIds"] is not JsonArray allowed || o["starterSpellIds"] is not JsonArray start) { Bad(p, "Invalid class-access record.");continue; }
            if (allowed.Count > 256 || start.Count > 12) Bad(p, "Class access exceeds list limits.");
            var permitted = new HashSet<string>(StringComparer.Ordinal);
            foreach (var node in allowed) {var id = Str(node, p + ".spellIds", 100, true);if (!ids.Contains(id) || !permitted.Add(id)) Bad(p + ".spellIds", "Duplicate/unknown spell."); }
            var started = new HashSet<string>(StringComparer.Ordinal);
            foreach (var node in start) {var id = Str(node, p + ".starterSpellIds", 100, true);if (!permitted.Contains(id) || !started.Add(id)) Bad(p + ".starterSpellIds", "Duplicate/not permitted starter spell."); }
        }
    }
}

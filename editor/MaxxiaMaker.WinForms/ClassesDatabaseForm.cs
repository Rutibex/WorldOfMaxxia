using System.Text.Json.Nodes;
using System.Diagnostics;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

/// <summary>MM07 native class browser/editor: typed controls, tags and traits, independent safe save.</summary>
public sealed class ClassesDatabaseForm : Form
{
    private sealed record ClassRow(string Id, string Name) { public override string ToString() => Name + "  [" + Id + "]"; }
    private readonly ClassDatabaseDocument document;
    private readonly HashSet<string> legacyIds;
    private readonly ListBox list = new() { Dock = DockStyle.Fill, IntegralHeight = false };
    private readonly TextBox search = new() { Dock = DockStyle.Top, PlaceholderText = "Search classes by name or ID" };
    private readonly Dictionary<string, Control> fields = new();
    private readonly CheckedListBox permissions = new() { CheckOnClick = true, Height = 210, Dock = DockStyle.Fill, IntegralHeight = false };
    private readonly CheckedListBox traits = new() { CheckOnClick = true, Height = 130, Dock = DockStyle.Fill, IntegralHeight = false };
    private readonly CheckedListBox styles = new() { CheckOnClick = true, Height = 175, Dock = DockStyle.Fill, IntegralHeight = false };
    private readonly Label status = new() { AutoSize = true };
    private readonly Label projection = new() { AutoSize = true, Padding = new Padding(5) };
    private readonly string projectRoot;

    private string? selectedId;
    private bool filling;
    private bool draft;

    public ClassesDatabaseForm(string manifestPath, ProjectManifest manifest)
    {
        if (manifest.Content.Classes is not { Length: > 0 } path)
            throw new ManifestException("E_CLASSES", "$.content.classes", "Project has no classes database. Declare content.classes first.");
        projectRoot = Path.GetDirectoryName(Path.GetFullPath(manifestPath))!;
        var full = Path.GetFullPath(Path.Combine(projectRoot, path.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(projectRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new ManifestException("E_CLASSES_PATH", "$.content.classes", "Classes database must be inside the project folder.");
        document = new ClassDatabaseDocument(full);
        legacyIds = new HashSet<string>(["myrmidon", "artificer", "mutant", "wizard", "priest", "witch"], StringComparer.Ordinal);
        Text = "Maxxia Maker — Classes database";
        ClientSize = new Size(1150, 850); MinimumSize = new Size(850, 610);
        Font = new Font("Segoe UI", 9.5F); StartPosition = FormStartPosition.CenterParent; AutoScaleMode = AutoScaleMode.Dpi;
        var split = new SplitContainer { Dock = DockStyle.Fill, SplitterDistance = 260, Panel1MinSize = 190, Panel2MinSize = 500 };
        var left = new Panel { Dock = DockStyle.Fill };
        var leftActions = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 75, AutoScroll = true, Padding = new Padding(3) };
        Button AddButton(Control parent, string label, Action action)
        {
            var b = new Button { Text = label, AutoSize = true, MinimumSize = new Size(72, 31) };
            b.Click += (_, _) => Safe(action); parent.Controls.Add(b); return b;
        }
        AddButton(leftActions, "New", Create);
        AddButton(leftActions, "Duplicate", Duplicate);
        AddButton(leftActions, "Delete", Delete);
        AddButton(leftActions, "Where Used", WhereUsed);
        left.Controls.Add(list); left.Controls.Add(search); left.Controls.Add(leftActions);
        split.Panel1.Controls.Add(left);

        var form = new TableLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, ColumnCount = 4, Padding = new Padding(10) };
        form.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 145));
        form.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        form.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 145));
        form.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        void Field(int row, int column, string key, string label, Control ctrl)
        {
            form.Controls.Add(new Label { Text = label, AutoSize = true, TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill }, column, row);
            ctrl.Dock = DockStyle.Fill; ctrl.Margin = new Padding(4);
            form.Controls.Add(ctrl, column + 1, row);
            fields[key] = ctrl;
            if (ctrl is TextBox t) t.TextChanged += (_, _) => Draft();
            if (ctrl is NumericUpDown n) n.ValueChanged += (_, _) => Draft();
            if (ctrl is ComboBox cb) cb.SelectedIndexChanged += (_, _) => { Draft(); Preview(); };
        }
        static ComboBox Choice(params string[] options)
        {
            var cb = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
            cb.Items.AddRange(options);return cb;
        }
        static NumericUpDown Number(int min, int max) => new() { Minimum = min, Maximum = max };
        Field(0, 0, "id", "Permanent class ID", new TextBox { ReadOnly = true });
        Field(0, 2, "name", "Display name", new TextBox { MaxLength = 100 });
        Field(1, 0, "primary", "Primary attribute", Choice("STR", "DEX", "CON", "INT", "WIS", "CHA"));
        Field(1, 2, "casting", "Casting attribute", Choice("", "STR", "DEX", "CON", "INT", "WIS", "CHA"));
        Field(2, 0, "hpBase", "Starting HP", Number(1, 500));
        Field(2, 2, "hpGain", "HP growth / level", Number(1, 100));
        Field(3, 0, "spBase", "Starting SP", Number(0, 500));
        Field(3, 2, "spGain", "SP growth / level", Number(0, 100));
        Field(4, 0, "spAttributeMultiplier", "SP attribute factor", Number(0, 20));
        Field(5, 0, "role", "Class role", new TextBox { Multiline = true, Height = 67, MaxLength = 1500 });
        Field(5, 2, "features", "Feature description", new TextBox { Multiline = true, Height = 67, MaxLength = 1500 });
        foreach (var key in ClassDatabaseReader.EquipmentTags) permissions.Items.Add(key);
        foreach (var key in ClassDatabaseReader.Traits) traits.Items.Add(key);
        foreach (var key in ClassDatabaseReader.Styles) styles.Items.Add(key);
        permissions.ItemCheck += (_, _) => { if (!filling) BeginInvoke(new Action(Draft)); };
        traits.ItemCheck += (_, _) => { if (!filling) BeginInvoke(new Action(Draft)); };
        styles.ItemCheck += (_, _) => { if (!filling) BeginInvoke(new Action(Draft)); };
        form.Controls.Add(new Label { Text = "Equipment permission tags", AutoSize = true }, 0, 6); form.Controls.Add(permissions, 1, 6);
        form.Controls.Add(new Label { Text = "Reusable class traits", AutoSize = true }, 2, 6); form.Controls.Add(traits, 3, 6);
        form.Controls.Add(new Label { Text = "Prepared attack styles", AutoSize = true }, 0, 7); form.Controls.Add(styles, 1, 7);
        var explain = new Label { Text = "Permissions match equipment tags in the Items database. Specialized styles require their matching trait. Duplicated classes reuse the same built-in attack behavior without source code changes.\n\nNew spells, prepared ability types and progression curves arrive in MM09–MM12.", AutoSize = true, MaximumSize = new Size(330, 0) };
        form.Controls.Add(explain, 2, 7);form.SetColumnSpan(explain, 2);
        form.Controls.Add(new Label { Text = "Growth illustration", AutoSize = true }, 0, 8);
        var actualPreview = new Button { Text = "Preview using game engine", AutoSize = true };
        actualPreview.Click += (_, _) => Safe(RuntimePreview);
        form.Controls.Add(projection, 1, 8);form.SetColumnSpan(projection, 2);
        form.Controls.Add(actualPreview, 3, 8);
        for (var i = 0; i <= 8; i++) form.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        var right = new Panel { Dock = DockStyle.Fill };
        var bottom = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 52, Padding = new Padding(5), FlowDirection = FlowDirection.RightToLeft };
        AddButton(bottom, "Close", Close);
        AddButton(bottom, "Save classes", Save);
        AddButton(bottom, "Apply changes", Commit);
        AddButton(bottom, "Redo", Redo);
        AddButton(bottom, "Undo", Undo);
        right.Controls.Add(form);right.Controls.Add(bottom);
        split.Panel2.Controls.Add(right);
        var bar = new StatusStrip();bar.Items.Add(new ToolStripControlHost(status));
        Controls.Add(split);Controls.Add(bar);
        list.SelectedIndexChanged += (_, _) => { if (!filling) Safe(SelectedChanged); };
        search.TextChanged += (_, _) => RefreshClasses();
        FormClosing += ClosingEditor;
        RefreshClasses();
    }

    private void Safe(Action action)
    {
        try { action(); } catch (Exception e) { MessageBox.Show(this, e.Message, "Class editor", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
    private void Draft() { if (filling) return; draft = true;UpdateStatus();Preview(); }
    private void UpdateStatus() => status.Text = $"{document.Model["classes"]!.AsArray().Count} classes · {(document.IsDirty ? "unsaved edits" : "saved")} · {(draft ? "unapplied form" : "applied form")}";
    private void Preview()
    {
        if (filling) return;
        if (fields.GetValueOrDefault("hpBase") is not NumericUpDown hp || fields.GetValueOrDefault("hpGain") is not NumericUpDown gain) return;
        // Illustration only. Actual combat numbers are calculated by the canonical TypeScript engine.
        var casting = (fields["casting"] as ComboBox)?.SelectedItem?.ToString();
        var sp = (fields["spBase"] as NumericUpDown)!.Value;var spGain = (fields["spGain"] as NumericUpDown)!.Value;
        projection.Text = $"Base growth, before Constitution and spellcasting modifiers: level 1 HP {hp.Value}, level 5 HP {hp.Value + gain.Value * 4}; SP {(string.IsNullOrEmpty(casting) ? 0 : sp)}, level 5 SP {(string.IsNullOrEmpty(casting) ? 0 : sp + spGain * 4)}. Runtime-derived stats may differ.";
    }
    private void RefreshClasses(string? pick = null)
    {
        filling = true;list.Items.Clear();var needle = search.Text.Trim();
        foreach (var n in document.Model["classes"]!.AsArray())
        {
            var id = n!["id"]!.GetValue<string>();var  name = n["name"]!.GetValue<string>();
            if (needle.Length > 0 && !id.Contains(needle, StringComparison.OrdinalIgnoreCase) && !name.Contains(needle, StringComparison.OrdinalIgnoreCase)) continue;
            var index = list.Items.Add(new ClassRow(id, name));
            if (id == (pick ?? selectedId)) list.SelectedIndex = index;
        }
        if (list.SelectedIndex < 0 && list.Items.Count > 0) list.SelectedIndex = 0;
        selectedId = (list.SelectedItem as ClassRow)?.Id;
        filling = false;LoadSelected();UpdateStatus();
    }
    private JsonObject? SelectedRecord() => document.Model["classes"]!.AsArray().OfType<JsonObject>().FirstOrDefault(x => x["id"]!.GetValue<string>() == selectedId);
    private void LoadSelected()
    {
        filling = true;var item = SelectedRecord();
        foreach (var (key, field) in fields)
        {
            var value = item?[key];field.Enabled = item is not null;
            switch (field)
            {
                case NumericUpDown n: n.Value = Math.Clamp(value?.GetValue<int>() ?? 0, (int)n.Minimum, (int)n.Maximum);break;
                case ComboBox cb: cb.SelectedItem = value?.GetValue<string>() ?? "";break;
                case TextBox t: t.Text = value?.GetValue<string>() ?? "";break;
            }
        }
        static void SetChecks(CheckedListBox target, JsonNode? node)
        {
            var active = node is JsonArray a ? a.Select(x => x!.GetValue<string>()).ToHashSet(StringComparer.Ordinal) : new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i < target.Items.Count; i++) target.SetItemChecked(i, active.Contains(target.Items[i]!.ToString()!));
        }
        SetChecks(permissions, item?["equipmentTags"]);SetChecks(traits, item?["traits"]);SetChecks(styles, item?["preparedStyles"]);
        filling = false;draft = false;Preview();UpdateStatus();
    }
    private bool ResolveDraft()
    {
        if (!draft) return true;
        var r = MessageBox.Show(this, "Apply form changes before switching records?", "Unapplied class changes", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
        if (r == DialogResult.Cancel) return false;
        if (r == DialogResult.Yes) Commit(); else LoadSelected();
        return true;
    }
    private void SelectedChanged()
    {
        var next = (list.SelectedItem as ClassRow)?.Id;
        if (next == selectedId) return;
        if (!ResolveDraft()) { RefreshClasses(selectedId);return; }
        selectedId = next;LoadSelected();
    }
    private void Commit()
    {
        var old = SelectedRecord();if (old is null) return;
        var root = document.Model;var  records = root["classes"]!.AsArray();var  updated = (JsonObject)old.DeepClone();
        foreach (var (key, field) in fields)
        {
            if (key == "id") continue;
            if (field is NumericUpDown n) updated[key] = (int)n.Value;
            else if (field is ComboBox cb) updated[key] = cb.SelectedItem is string s && s.Length > 0 ? s : null;
            else if (field is TextBox tb) updated[key] = tb.Text;
        }
        static JsonArray Values(CheckedListBox list) => new(list.CheckedItems.Cast<string>().Select(v => (JsonNode?)JsonValue.Create(v)).ToArray());
        updated["equipmentTags"] = Values(permissions);updated["traits"] = Values(traits);updated["preparedStyles"] = Values(styles);
        var i = records.ToList().FindIndex(x => x?["id"]?.GetValue<string>() == selectedId);
        if (i < 0) return;
        records[i] = updated;ClassDatabaseReader.Validate(root);
        document.Apply(root.ToJsonString());draft = false;RefreshClasses(selectedId);
    }
    private void RuntimePreview()
    {
        // Keep gameplay logic in TypeScript. Source-tree development preview uses its canonical derived() function.
        var candidate = SelectedRecord();if (candidate is null) return;
        // Preview accepted changes, never silently read an unapplied UI draft.
        if (draft) Commit();
        candidate = SelectedRecord();if (candidate is null) return;
        string? script = null;
        foreach (var starting in new[] { projectRoot, AppContext.BaseDirectory })
        {
            var dir = new DirectoryInfo(starting);
            for (var depth = 0; dir is not null && depth < 10; depth++, dir = dir.Parent)
            {
                var possible = Path.Combine(dir.FullName, "engine", "world-of-maxxia", "scripts", "preview-class.mjs");
                if (File.Exists(possible)) { script = possible;break; }
            }
            if (script is not null) break;
        }
        if (script is null) { MessageBox.Show(this, "Live gameplay preview requires the complete source tree. The base-growth illustration remains visible; no gameplay values are inferred as validated.", "Runtime preview unavailable");return; }
        var start = new ProcessStartInfo("node") { UseShellExecute = false, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true };
        start.ArgumentList.Add("--experimental-strip-types");start.ArgumentList.Add(script);
        using var process = Process.Start(start) ?? throw new IOException("Node runtime did not launch. Install Node.js 22.18+ for developer previews.");
        process.StandardInput.Write(candidate.ToJsonString());process.StandardInput.Close();
        if (!process.WaitForExit(5000)) { process.Kill(entireProcessTree: true);throw new TimeoutException("Runtime preview exceeded five seconds."); }
        var output = process.StandardOutput.ReadToEnd();
        var errors = process.StandardError.ReadToEnd();
        if (process.ExitCode != 0) throw new IOException("Game-engine preview failed: " + errors[..Math.Min(1200, errors.Length)]);
        var data = JsonNode.Parse(output)!.AsObject();
        var numbers = data["rows"]!.AsArray().Select(x => $"Level {x!["level"]}: HP {x["maxHP"]}, SP {x["maxSP"]}, Defense {x["defense"]}");
        MessageBox.Show(this, "Canonical TypeScript gameplay-derived stats:\n" + string.Join("\n", numbers) + "\n\nCON 14, primary/casting 16, no equipment or conditions. These are computed by the game engine, not a C# duplicate.", "Runtime class preview");
    }
    private void Create()
    {
        if (!ResolveDraft()) return;
        var root = document.Model;var  id = ClassDatabaseReader.NewId();
        root["classes"]!.AsArray().Add(new JsonObject {
            ["id"] = id, ["name"] = "New Class", ["primary"] = "STR", ["casting"] = null, ["hpBase"] = 10, ["hpGain"] = 5,
            ["spBase"] = 0, ["spGain"] = 0, ["spAttributeMultiplier"] = 0,
            ["role"] = "A new adventurer class.", ["features"] = "", ["equipmentTags"] = new JsonArray(JsonValue.Create("melee:general"), JsonValue.Create("armor:light"), JsonValue.Create("accessory")),
            ["traits"] = new JsonArray(), ["preparedStyles"] = new JsonArray(JsonValue.Create("standard"))
        });
        ClassDatabaseReader.Validate(root);document.Apply(root.ToJsonString());search.Text = "";RefreshClasses(id);
    }
    private void Duplicate()
    {
        if (!ResolveDraft() || SelectedRecord() is not { } original) return;
        var root = document.Model;var  id = ClassDatabaseReader.NewId();var  copy = (JsonObject)original.DeepClone();
        copy["id"] = id;copy["name"] = original["name"]!.GetValue<string>() + " Copy";
        root["classes"]!.AsArray().Add(copy);ClassDatabaseReader.Validate(root);document.Apply(root.ToJsonString());search.Text = "";RefreshClasses(id);
    }
    private List<string> Uses(string id)
    {
        var result = new List<string>();
        foreach (var file in Directory.EnumerateFiles(projectRoot, "*.json", SearchOption.AllDirectories))
        {
            if (Path.GetFullPath(file) == document.FilePath || new FileInfo(file).Length > 1024 * 1024) continue;
            try { if (File.ReadAllText(file).Contains('"' + id + '"', StringComparison.Ordinal)) result.Add(Path.GetRelativePath(projectRoot, file)); }
            catch (IOException) { /* Keep the incomplete result explicitly advisory. */ }
        }
        return result;
    }
    private void WhereUsed()
    {
        if (selectedId is null) return;
        var references = Uses(selectedId);
        MessageBox.Show(this, references.Count == 0 ? "No project JSON references found. Compiled spell definitions and existing saves are not yet indexed." : string.Join("\n", references.Take(30)) + "\n\nCompiled references and saves may also exist.", "Where Used — " + selectedId);
    }
    private void Delete()
    {
        if (!ResolveDraft() || selectedId is null) return;
        if (legacyIds.Contains(selectedId)) { MessageBox.Show(this, "Original class IDs are protected while compiled spells and original saves refer to them. New unreferenced classes can be deleted.", "Protected class"); return; }
        var references = Uses(selectedId);
        if (references.Count > 0) { MessageBox.Show(this, "Remove these references before deleting:\n" + string.Join("\n", references.Take(16)), "Class is referenced"); return; }
        if (MessageBox.Show(this, "Delete this class definition? Existing saves might still use it.", "Confirm deletion", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        var root = document.Model;var  arr = root["classes"]!.AsArray();
        var index = arr.ToList().FindIndex(x => x?["id"]?.GetValue<string>() == selectedId);
        if (index >= 0) { arr.RemoveAt(index);ClassDatabaseReader.Validate(root);document.Apply(root.ToJsonString());selectedId = null;RefreshClasses(); }
    }
    private void Undo() { if (!ResolveDraft()) return;document.Undo();RefreshClasses(selectedId); }
    private void Redo() { if (!ResolveDraft()) return;document.Redo();RefreshClasses(selectedId); }
    private void Save() { if (!ResolveDraft()) return;document.Save();UpdateStatus(); }
    private void ClosingEditor(object? sender, FormClosingEventArgs e)
    {
        if (!ResolveDraft()) { e.Cancel = true;return; }
        if (!document.IsDirty) return;
        var option = MessageBox.Show(this, "Save accepted class changes before closing?", "Unsaved class data", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
        if (option == DialogResult.Cancel) { e.Cancel = true; return; }
        if (option == DialogResult.Yes) { try { Save(); } catch (Exception error) { MessageBox.Show(this, error.Message, "Save failed");e.Cancel = true; } }
    }
    protected override bool ProcessCmdKey(ref Message msg, Keys key)
    {
        if (key == (Keys.Control | Keys.S)) { Safe(Save);return true; }
        if (key == (Keys.Control | Keys.Z)) { Safe(Undo);return true; }
        if (key == (Keys.Control | Keys.Y)) { Safe(Redo);return true; }
        return base.ProcessCmdKey(ref msg, key);
    }
}

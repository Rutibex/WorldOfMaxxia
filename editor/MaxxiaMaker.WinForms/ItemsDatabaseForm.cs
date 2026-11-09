using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

/// <summary>MM06 first purpose-built RPG Maker-style database form. All edits use an independent JSON document.</summary>
public sealed class ItemsDatabaseForm : Form
{
    private sealed record ItemRow(string Id, string Name) { public override string ToString() => Name + "  [" + Id + "]"; }
    private sealed record IconChoice(string Id, string Name, string? FilePath)
    {
        public override string ToString() => string.IsNullOrEmpty(Id) ? "None / fallback" : Name + "  [" + Id + "]";
    }
    private readonly ItemDatabaseDocument document;
    private readonly string projectRoot;
    private readonly ListBox list = new() { Dock = DockStyle.Fill, IntegralHeight = false };
    private readonly TextBox search = new() { Width = 250, PlaceholderText = "Find item by name or ID" };
    private readonly Label status = new() { AutoSize = true, Padding = new Padding(5) };
    private readonly PictureBox iconPreview = new() { Width = 112, Height = 112, SizeMode = PictureBoxSizeMode.Zoom, BorderStyle = BorderStyle.FixedSingle };
    private readonly Dictionary<string, Control> fields = new();
    private readonly ComboBox icon = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 360 };
    private readonly HashSet<string> baselineIds;
    private string? selectedId;
    private bool filling;
    private bool draft;
    private Bitmap? previewImage;
    private readonly ResourceCatalogDocument? resources;
    public ItemsDatabaseForm(string manifestPath, ProjectManifest manifest)
    {
        if (manifest.Content.Items is not { Length: > 0 } path) throw new ManifestException("E_ITEMS", "$.content.items", "This project has no items database. Assign content.items in the project settings first.");
        projectRoot = Path.GetDirectoryName(Path.GetFullPath(manifestPath))!;
        string file = Path.GetFullPath(Path.Combine(projectRoot, path.Replace('/', Path.DirectorySeparatorChar)));
        if (!file.StartsWith(projectRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new ManifestException("E_ITEMS_PATH", "$.content.items", "Database must be inside the project root.");
        document = new ItemDatabaseDocument(file);
        baselineIds = document.Model["items"]!.AsArray().Select(x => x!["id"]!.GetValue<string>()).ToHashSet(StringComparer.Ordinal);
        resources = ResourceCatalogReader.Read(manifestPath, manifest);
        Text = "Maxxia Maker — Items database"; ClientSize = new Size(1160, 810); MinimumSize = new Size(850, 570);
        Font = new Font("Segoe UI", 9F); AutoScaleMode = AutoScaleMode.Dpi; StartPosition = FormStartPosition.CenterParent;
        var outer = new SplitContainer { Dock = DockStyle.Fill, SplitterDistance = 285, Panel1MinSize = 225, Panel2MinSize = 470 };
        var left = new Panel { Dock = DockStyle.Fill };
        var filter = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 38, Padding = new Padding(4), WrapContents = false }; filter.Controls.Add(search);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 76, Padding = new Padding(4) };
        Button Action(string label, Action handler, Control target) { var b = new Button { Text = label, AutoSize = true, MinimumSize = new Size(74, 32) }; b.Click += (_, _) => Safe(handler); target.Controls.Add(b); return b; }
        Action("New", Create, actions); Action("Duplicate", Duplicate, actions); Action("Delete", Delete, actions); Action("Where Used", WhereUsed, actions);
        left.Controls.Add(list); left.Controls.Add(actions); left.Controls.Add(filter); outer.Panel1.Controls.Add(left);
        var form = new TableLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, ColumnCount = 4, Padding = new Padding(12), AutoSize = false };
        form.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 116));form.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));form.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 116));form.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        void Field(string key, string label, Control control, int column, int row)
        {
            form.Controls.Add(new Label { Text = label, TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill, AutoSize = true }, column, row);
            control.Dock = DockStyle.Fill; control.Margin = new Padding(3, 4, 7, 4); form.Controls.Add(control, column + 1, row); fields[key] = control;
            switch (control) { case TextBox t: t.TextChanged += (_, _) => Draft(); break; case ComboBox c: c.SelectedIndexChanged += (_, _) => Draft(); break; case NumericUpDown n: n.ValueChanged += (_, _) => Draft(); break; case CheckBox checkbox: checkbox.CheckedChanged += (_, _) => Draft(); break; }
        }
        TextBox TextField() => new() { MaxLength = 2000 };
        ComboBox Choice(params string[] values) { var box = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList }; box.Items.AddRange(values); return box; }
        NumericUpDown Number(int min, int max) => new() { Minimum = min, Maximum = max, ThousandsSeparator = true };
        Field("id", "Stable ID", TextField(), 0, 0); ((TextBox)fields["id"]).ReadOnly = true;
        Field("name", "Name", TextField(), 2, 0);
        Field("category", "Category", Choice("weapons", "armor", "accessories", "misc"), 0, 1);
        Field("slot", "Equipment slot", Choice("", "melee", "ranged", "body", "offhand", "accessory"), 2, 1);
        Field("price", "Gold value", Number(0, 100000000), 0, 2);
        Field("maxDurability", "Max durability", Number(0, 10000), 2, 2);
        Field("maxCharges", "Max charges", Number(0, 10000), 0, 3);
        Field("effect", "Use effect", Choice("none", "heal", "antidote", "wake", "courage", "light", "escape", "acid", "spark", "venom", "recall", "identify"), 2, 3);
        Field("power", "Effect power", Number(0, 100000), 0, 4);
        Field("unique", "Unique", new CheckBox { AutoSize = true }, 2, 4);
        Field("weight", "Armor weight", Choice("", "light", "medium", "heavy"), 0, 5);
        Field("armor", "Armor bonus", Number(0, 10000), 2, 5);
        Field("dice", "Damage dice", TextField(), 0, 6);
        Field("accuracy", "Accuracy", Number(-1000, 1000), 2, 6);
        Field("resistance", "Resistance", TextField(), 0, 7);
        Field("resistBonus", "Resist bonus %", Number(-100, 100), 2, 7);
        var description = new TextBox { Multiline = true, ScrollBars = ScrollBars.Vertical, Height = 85, MaxLength = 2000 };
        Field("description", "Description", description, 0, 8);form.SetColumnSpan(description, 3);
        var icons = resources?.Resources.Where(r => r.Kind == "image" && r.Exists).OrderBy(r => r.Name).Select(r => new IconChoice(r.Id, r.Name, r.FilePath)).ToArray() ?? [];
        icon.Items.Add(new IconChoice("", "None", null));icon.Items.AddRange(icons);icon.SelectedIndexChanged += (_, _) => { Draft(); Preview(); };
        form.Controls.Add(new Label { Text = "Item icon", AutoSize = true }, 0, 9);form.Controls.Add(icon, 1, 9);form.SetColumnSpan(icon, 2);
        form.Controls.Add(iconPreview, 3, 9);
        var itemTags = new TextBox { PlaceholderText = "e.g. melee:staff, melee:dagger", Width = 380 };
        itemTags.TextChanged += (_, _) => Draft();
        form.Controls.Add(new Label { Text = "Equipment tags", AutoSize = true }, 0, 10);
        form.Controls.Add(itemTags, 1, 10);form.SetColumnSpan(itemTags, 3);
        fields["equipmentTags"] = itemTags;
        form.RowCount = 11;
        for (int n = 0; n < 11; n++) form.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        var center = new Panel { Dock = DockStyle.Fill }; center.Controls.Add(form);
        var bottom = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 49, Padding = new Padding(5), FlowDirection = FlowDirection.RightToLeft, WrapContents = false };
        Action("Close", Close, bottom);Action("Save items", Save, bottom);Action("Apply changes", Commit, bottom);Action("Redo", Redo, bottom);Action("Undo", Undo, bottom);
        center.Controls.Add(bottom); outer.Panel2.Controls.Add(center);
        var strip = new StatusStrip();strip.Items.Add(new ToolStripControlHost(status));
        Controls.Add(outer); Controls.Add(strip);
        search.TextChanged += (_, _) => RefreshItems();
        list.SelectedIndexChanged += (_, _) => { if (!filling) Safe(SelectedChanged); };
        FormClosing += ClosingEditor;
        FormClosed += (_, _) => { previewImage?.Dispose(); iconPreview.Image = null; };
        RefreshItems();
    }
    private void Safe(Action action)
    {
        try { action(); }
        catch (Exception e) { MessageBox.Show(this, e.Message, "Item editing error", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
    private void Draft() { if (!filling) { draft = true; UpdateStatus(); } }
    private void UpdateStatus() { status.Text = $"{document.Model["items"]!.AsArray().Count} items • {(document.IsDirty ? "unsaved edits" : "saved")} • {(draft ? "unapplied form" : "form accepted")} • Ctrl+S saves"; }
    private void RefreshItems(string? select = null)
    {
        filling = true;
        list.Items.Clear();var needle = search.Text.Trim();
        foreach (var n in document.Model["items"]!.AsArray())
        {
            var id = n!["id"]!.GetValue<string>();var  name = n["name"]!.GetValue<string>();
            if (needle.Length > 0 && !id.Contains(needle, StringComparison.OrdinalIgnoreCase) && !name.Contains(needle, StringComparison.OrdinalIgnoreCase)) continue;
            int idx = list.Items.Add(new ItemRow(id, name));
            if (id == (select ?? selectedId)) list.SelectedIndex = idx;
        }
        if (list.SelectedIndex < 0 && list.Items.Count > 0) list.SelectedIndex = 0;
        selectedId = (list.SelectedItem as ItemRow)?.Id;
        filling = false; LoadSelected(); UpdateStatus();
    }
    private JsonObject? SelectedRecord() => document.Model["items"]!.AsArray().OfType<JsonObject>().FirstOrDefault(n => n["id"]!.GetValue<string>() == selectedId);
    private void LoadSelected()
    {
        filling = true;
        var item = SelectedRecord();
        foreach (var (key, ctrl) in fields)
        {
            var value = item?[key];
            if (key == "equipmentTags" && ctrl is TextBox tagBox) { tagBox.Text = value is JsonArray tags ? string.Join(", ", tags.Select(x => x!.GetValue<string>())) : ""; continue; }
            switch (ctrl)
            {
                case NumericUpDown n: n.Value = Math.Clamp(value?.GetValue<int>() ?? 0, (int)n.Minimum, (int)n.Maximum); break;
                case CheckBox checkbox: checkbox.Checked = value?.GetValue<bool>() ?? false; break;
                case ComboBox c: c.SelectedItem = value?.GetValue<string>() ?? ""; break;
                case TextBox t: t.Text = value?.GetValue<string>() ?? ""; break;
            }
            ctrl.Enabled = item is not null;
        }
        var iconId = item?["iconResourceId"]?.GetValue<string>() ?? "";
        var choice = icon.Items.OfType<IconChoice>().FirstOrDefault(i => i.Id == iconId);
        if (choice is null && iconId.Length > 0) { choice = new IconChoice(iconId, "Missing resource", null); icon.Items.Add(choice); }
        icon.SelectedItem = choice ?? icon.Items[0];
        draft = false; filling = false; Preview(); UpdateStatus();
    }
    private void Preview()
    {
        iconPreview.Image = null; previewImage?.Dispose(); previewImage = null;
        if (icon.SelectedItem is not IconChoice { FilePath: { } file } || !File.Exists(file)) return;
        try { using var stream = File.Open(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite); using var img = Image.FromStream(stream); previewImage = new Bitmap(img); iconPreview.Image = previewImage; }
        catch { /* Unsupported media or corrupt image is left visible as catalogue metadata. */ }
    }
    private bool ResolveDraft()
    {
        if (!draft) return true;
        var result = MessageBox.Show(this, "Apply the item form changes before switching records?", "Unapplied changes", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
        if (result == DialogResult.Cancel) return false;
        if (result == DialogResult.Yes) Commit(); else LoadSelected();
        return true;
    }
    private void SelectedChanged()
    {
        var next = (list.SelectedItem as ItemRow)?.Id;
        if (next == selectedId) return;
        if (!ResolveDraft()) { RefreshItems(selectedId); return; }
        selectedId = next; LoadSelected();
    }
    private void Commit()
    {
        if (SelectedRecord() is not { } old) return;
        var json = document.Model;var  items = json["items"]!.AsArray();
        var edited = (JsonObject)old.DeepClone();
        foreach (var (key, control) in fields)
        {
            if (key == "id") continue;
            switch (control)
            {
                case NumericUpDown n: edited[key] = (int)n.Value; break;
                case CheckBox checkbox: edited[key] = checkbox.Checked; break;
                case ComboBox c: edited[key] = c.SelectedItem?.ToString() is { Length: > 0 } choice ? choice : null; break;
                case TextBox t when key == "equipmentTags": edited[key] = new JsonArray(t.Text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(x => (JsonNode?)JsonValue.Create(x)).ToArray()); break;
                case TextBox t: edited[key] = t.Text; break;
            }
        }
        // The category/effect fields may never be null, unlike the slot/weight fields.
        if (icon.SelectedItem is IconChoice selected && selected.Id.Length > 0) edited["iconResourceId"] = selected.Id;
        else edited.Remove("iconResourceId");
        var pos = items.ToList().FindIndex(n => n?["id"]?.GetValue<string>() == selectedId);
        if (pos < 0) return;
        items[pos] = edited;
        ItemDatabaseReader.Validate(json);
        document.Apply(json.ToJsonString()); draft = false; RefreshItems(selectedId);
    }
    private void Create()
    {
        if (!ResolveDraft()) return;
        var json = document.Model;var  array = json["items"]!.AsArray();
        var id = ItemDatabaseReader.NewId();
        var item = new JsonObject { ["id"] = id, ["name"] = "New Item", ["category"] = "misc", ["price"] = 1, ["maxDurability"] = 0, ["maxCharges"] = 0, ["effect"] = "none", ["power"] = 0, ["unique"] = false, ["slot"] = null, ["weight"] = null, ["armor"] = 0, ["dice"] = null, ["accuracy"] = 0, ["resistance"] = null, ["resistBonus"] = 0, ["description"] = "" };
        array.Add(item); ItemDatabaseReader.Validate(json); document.Apply(json.ToJsonString());search.Text = "";RefreshItems(id);
    }
    private void Duplicate()
    {
        if (!ResolveDraft() || SelectedRecord() is not { } source) return;
        var json = document.Model;var  array = json["items"]!.AsArray();var id = ItemDatabaseReader.NewId();
        var copy = (JsonObject)source.DeepClone();copy["id"] = id;copy["name"] = source["name"]!.GetValue<string>() + " Copy";
        array.Add(copy);ItemDatabaseReader.Validate(json);document.Apply(json.ToJsonString());search.Text = "";RefreshItems(id);
    }
    private void Delete()
    {
        if (!ResolveDraft() || selectedId is null) return;
        if (baselineIds.Contains(selectedId)) { MessageBox.Show(this, "MM06 protects the original 48 items because compiled legacy loot and equipment references still use them. New items can be deleted when unreferenced.", "Protected legacy item"); return; }
        var uses = FindReferences(selectedId);
        if (uses.Count > 0) { MessageBox.Show(this, "Remove these references before deleting:\n" + string.Join("\n", uses.Take(16)), "Item is referenced"); return; }
        if (MessageBox.Show(this, "Delete this new, unreferenced item? Existing save instances may still depend on it.", "Confirm deletion", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        var json = document.Model;var  array = json["items"]!.AsArray();
        var index = array.ToList().FindIndex(x => x?["id"]?.GetValue<string>() == selectedId);
        if (index >= 0) { array.RemoveAt(index); document.Apply(json.ToJsonString()); selectedId = null; RefreshItems(); }
    }
    private List<string> FindReferences(string id)
    {
        var result = new List<string>();
        foreach (var file in Directory.EnumerateFiles(projectRoot, "*.json", SearchOption.AllDirectories))
        {
            if (Path.GetFullPath(file) == document.FilePath || new FileInfo(file).Length > 1024 * 1024) continue;
            try { if (File.ReadAllText(file).Contains("\"" + id + "\"", StringComparison.Ordinal)) result.Add(Path.GetRelativePath(projectRoot, file)); }
            catch (IOException) { /* Report partial reference list, not a guarantee. */ }
        }
        return result;
    }
    private void WhereUsed()
    {
        if (selectedId is null) return;
        var uses = FindReferences(selectedId);
        MessageBox.Show(this, uses.Count == 0 ? "No references found in project JSON files. Compiled legacy gameplay references and existing save slots are not yet indexed (MM38)." : string.Join("\n", uses.Take(30)) + "\n\nCompiled legacy references are not included.", "Where Used — " + selectedId);
    }
    private void Undo() { if (!ResolveDraft()) return; document.Undo(); RefreshItems(selectedId); }
    private void Redo() { if (!ResolveDraft()) return; document.Redo(); RefreshItems(selectedId); }
    private void Save()
    {
        if (!ResolveDraft()) return;
        document.Save();UpdateStatus();
    }
    private void ClosingEditor(object? sender, FormClosingEventArgs e)
    {
        if (!ResolveDraft()) { e.Cancel = true; return; }
        if (!document.IsDirty) return;
        var option = MessageBox.Show(this, "Save database changes before closing?", "Unsaved item definitions", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
        if (option == DialogResult.Cancel) { e.Cancel = true; return; }
        if (option == DialogResult.Yes) { try { Save(); } catch (Exception error) { MessageBox.Show(this, error.Message, "Save failed"); e.Cancel = true; } }
    }
    protected override bool ProcessCmdKey(ref Message msg, Keys keys)
    {
        if (keys == (Keys.Control | Keys.S)) { Safe(Save); return true; }
        if (keys == (Keys.Control | Keys.Z)) { Safe(Undo); return true; }
        if (keys == (Keys.Control | Keys.Y)) { Safe(Redo); return true; }
        return base.ProcessCmdKey(ref msg, keys);
    }
}

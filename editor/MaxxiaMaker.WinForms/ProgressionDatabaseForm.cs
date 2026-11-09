using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker;
/// <summary>MM09 focused XP, training, prepared ability and trait editor.</summary>
public sealed class ProgressionDatabaseForm : Form
{
    private readonly ProgressionDatabaseDocument document;
    private readonly Dictionary<string, NumericUpDown> numeric = new();
    private readonly CheckedListBox milestones = new() { Dock = DockStyle.Fill, CheckOnClick = true };
    private readonly DataGridView xpGrid = new() { Dock = DockStyle.Fill, AllowUserToAddRows = false, AllowUserToDeleteRows = false, RowHeadersVisible = false, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill };
    private readonly ListBox styles = new() { Dock = DockStyle.Fill };
    private readonly TextBox name = new() { Dock = DockStyle.Top };
    private readonly Dictionary<string, NumericUpDown> styleNumbers = new();
    private readonly CheckBox replaceBase = new() { Text = "Milestone damage replaces baseline (devices)", AutoSize = true };
    private readonly Label styleInfo = new() { AutoSize = true, MaximumSize = new Size(650, 0) };
    private readonly Label status = new() { AutoSize = true };
    private string? styleId;
    private bool filling;
    private bool draft;
    public ProgressionDatabaseForm(string manifestPath, ProjectManifest project)
    {
        if (string.IsNullOrWhiteSpace(project.Content.Progression)) throw new ManifestException("E_PROGRESSION", "$.content.progression", "No progression database declared.");
        var root = Path.GetDirectoryName(Path.GetFullPath(manifestPath))!;
        var path = Path.GetFullPath(Path.Combine(root, project.Content.Progression.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new ManifestException("E_PROGRESSION_PATH", "$.content.progression", "Progression must remain inside project.");
        document = new ProgressionDatabaseDocument(path);
        Text = "Maxxia Maker — Progression and prepared abilities";ClientSize = new Size(990, 780);MinimumSize = new Size(730, 580);StartPosition = FormStartPosition.CenterParent;Font = new Font("Segoe UI", 9.5F);AutoScaleMode = AutoScaleMode.Dpi;
        var tabs = new TabControl { Dock = DockStyle.Fill };
        var progressionTab = new TabPage("Level progression");var progressionPanel = new TableLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, ColumnCount = 2, Padding = new Padding(12) };
        progressionPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 230));progressionPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        int row = 0;
        void AddNumber(TableLayoutPanel panel, string key, string label, int min, int max, Dictionary<string, NumericUpDown> target)
        {
            var control = new NumericUpDown { Minimum = min, Maximum = max, Dock = DockStyle.Top, ThousandsSeparator = true, Height = 28 };
            target[key] = control;panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));panel.Controls.Add(new Label { Text = label, AutoSize = true, Padding = new Padding(2, 6, 2, 3) }, 0, row);panel.Controls.Add(control, 1, row);row++;
            control.ValueChanged += (_, _) => { if (!filling) draft = true; };
        }
        AddNumber(progressionPanel, "maxLevel", "Maximum level (1–20)", 1, 20, numeric);
        AddNumber(progressionPanel, "trainingGoldPerLevel", "Trainer gold × next level", 0, 100000, numeric);
        AddNumber(progressionPanel, "proficiency.base", "Starting proficiency", 0, 20, numeric);
        AddNumber(progressionPanel, "proficiency.veteranLevel", "Veteran proficiency starts at", 2, 20, numeric);
        AddNumber(progressionPanel, "proficiency.veteranBonus", "Veteran proficiency", 0, 20, numeric);
        AddNumber(progressionPanel, "preparedMilestoneLevel", "Prepared improvement level", 2, 20, numeric);
        AddNumber(progressionPanel, "preparedVeteranLevel", "Prepared veteran level", 2, 20, numeric);
        xpGrid.Columns.Add("Level", "Level");xpGrid.Columns.Add("XP", "Total XP required (levels 0/1 = 0)");xpGrid.Columns[0].ReadOnly = true;
        xpGrid.CellValueChanged += (_, _) => { if (!filling) draft = true; };
        xpGrid.CurrentCellDirtyStateChanged += (_, _) => { if (xpGrid.IsCurrentCellDirty) xpGrid.CommitEdit(DataGridViewDataErrorContexts.Commit); };
        numeric["maxLevel"].ValueChanged += (_, _) => { if (!filling) { draft = true; UpdateLevelRows(); } };
        progressionPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 210));progressionPanel.Controls.Add(new Label { Text = "XP thresholds (edit values in table)", AutoSize = true }, 0, row);progressionPanel.Controls.Add(xpGrid, 1, row++);
        progressionPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 185));progressionPanel.Controls.Add(new Label { Text = "Attribute gain milestones", AutoSize = true }, 0, row);progressionPanel.Controls.Add(milestones, 1, row++);milestones.ItemCheck += (_, _) => { if (!filling) draft = true; };
        progressionTab.Controls.Add(progressionPanel);tabs.TabPages.Add(progressionTab);
        var abilities = new TabPage("Prepared abilities");var split = new SplitContainer { Dock = DockStyle.Fill, SplitterDistance = 210, Panel1MinSize = 150, Panel2MinSize = 400 };
        split.Panel1.Controls.Add(styles);
        var props = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, Padding = new Padding(10) };
        void Property(string label, Control control) { props.Controls.Add(new Label { Text = label, AutoSize = true });control.Width = 340;props.Controls.Add(control); }
        Property("Display name", name);name.TextChanged += (_, _) => { if (!filling) draft = true; };
        foreach (var key in new[] { "attackBonus", "attackBonusAtVeteran", "damageBonus", "damageBonusAtMilestone", "ignoreDefense", "defenseBonus", "defenseAtVeteran" })
        {
            var n = new NumericUpDown { Minimum = key == "attackBonus" ? -20 : 0, Maximum = 20, Width = 120 };
            styleNumbers[key] = n;Property(key, n);n.ValueChanged += (_, _) => { if (!filling) draft = true; };
        }
        props.Controls.Add(replaceBase);replaceBase.CheckedChanged += (_, _) => { if (!filling) draft = true; };
        props.Controls.Add(styleInfo);styleInfo.Text = "Operations, required traits, damage types and dice live in the validated project JSON. This form edits names and numeric tuning; no scripting or per-hit decisions are introduced.";
        split.Panel2.Controls.Add(props);abilities.Controls.Add(split);tabs.TabPages.Add(abilities);
        styles.SelectedIndexChanged += (_, _) => ShowStyle();
        var traits = new TabPage("Trait tuning");var traitPanel = new TableLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, ColumnCount = 2, Padding = new Padding(12) };traitPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 245));traitPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));row = 0;
        foreach (var key in new[] { "device_training.rangedAccuracy", "device_training.rangedVeteranAccuracy", "device_training.rangedMilestoneDamage", "thornhide.reflectAtMilestone" })AddNumber(traitPanel, "trait." + key, key.Replace('.', ' '), 0, 20, numeric);
        traitPanel.Controls.Add(new Label { Text = "Traits stay attached to class IDs through the Classes editor. These modifiers apply to every class with the corresponding trait.", MaximumSize = new Size(500, 0), AutoSize = true }, 1, row);
        traits.Controls.Add(traitPanel);tabs.TabPages.Add(traits);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, AutoSize = true, Padding = new Padding(8), WrapContents = true };
        void Button(string text, Action action) { var b = new Button { Text = text, AutoSize = true, MinimumSize = new Size(82, 30) };b.Click += (_, _) => Safe(action);buttons.Controls.Add(b); }
        Button("Apply changes", Apply);Button("Undo", Undo);Button("Redo", Redo);Button("Save", Save);Button("Close", Close);
        buttons.Controls.Add(status);Controls.Add(tabs);Controls.Add(buttons);FormClosing += Closing;RefreshForm();
    }
    private void Safe(Action action) { try { action(); } catch (Exception e) { MessageBox.Show(this, e.Message, "Maxxia Maker", MessageBoxButtons.OK, MessageBoxIcon.Warning); } }
    private void UpdateLevelRows()
    {
        var count = (int)numeric["maxLevel"].Value + 1;
        while (xpGrid.Rows.Count < count)
        {
            var i = xpGrid.Rows.Count;var  prev = i == 0 ? 0 : int.TryParse(xpGrid.Rows[i - 1].Cells[1].Value?.ToString(), out var xp) ? xp : 0;
            xpGrid.Rows.Add(i, i < 2 ? 0 : prev + 1000);
        }
        while (xpGrid.Rows.Count > count) xpGrid.Rows.RemoveAt(xpGrid.Rows.Count - 1);
        var prior = milestones.CheckedItems.Cast<int>().ToHashSet();milestones.Items.Clear();for (var i = 2; i < count; i++) milestones.Items.Add(i, prior.Contains(i));
    }
    private void RefreshForm()
    {
        filling = true;
        try
        {
            var root = document.Model;
            numeric["maxLevel"].Value = root["maxLevel"]!.GetValue<int>();numeric["trainingGoldPerLevel"].Value = root["trainingGoldPerLevel"]!.GetValue<int>();
            foreach (var key in new[] { "base", "veteranLevel", "veteranBonus" }) numeric["proficiency." + key].Value = root["proficiency"]![key]!.GetValue<int>();
            foreach (var key in new[] { "preparedMilestoneLevel", "preparedVeteranLevel" }) numeric[key].Value = root[key]!.GetValue<int>();
            foreach (var key in new[] { "device_training.rangedAccuracy", "device_training.rangedVeteranAccuracy", "device_training.rangedMilestoneDamage", "thornhide.reflectAtMilestone" })
            { var parts = key.Split('.'); numeric["trait." + key].Value = root["traitBonuses"]![parts[0]]![parts[1]]!.GetValue<int>(); }
            xpGrid.Rows.Clear();var curve = root["xpThresholds"]!.AsArray();for (var i = 0; i < curve.Count; i++) xpGrid.Rows.Add(i, curve[i]!.GetValue<int>());
            milestones.Items.Clear();var selected = root["attributeMilestoneLevels"]!.AsArray().Select(x => x!.GetValue<int>()).ToHashSet();for (var i = 2; i <= (int)numeric["maxLevel"].Value; i++) milestones.Items.Add(i, selected.Contains(i));
            var selection = styleId;styles.Items.Clear();foreach (var entry in root["prepared"]!.AsArray()) styles.Items.Add(entry!["id"]!.GetValue<string>());
            styles.SelectedItem = selection is not null && styles.Items.Contains(selection) ? selection : styles.Items[0];draft = false;UpdateStatus();
        }
        finally { filling = false; }
        ShowStyle();
    }
    private void ShowStyle()
    {
        if (filling) return;
        if (draft && styleId is not null && styles.SelectedItem?.ToString() != styleId)
        { if (MessageBox.Show(this, "Apply or discard changes before switching? Yes = Apply, No = Discard, Cancel = Stay", "Unsaved draft", MessageBoxButtons.YesNoCancel) is var choice)
            { if (choice == DialogResult.Cancel) { filling = true;styles.SelectedItem = styleId;filling = false;return; }if (choice == DialogResult.Yes) { try { Apply(); } catch (Exception error) { MessageBox.Show(this, error.Message);filling = true;styles.SelectedItem = styleId;filling = false;return; } }else RefreshForm(); } }
        styleId = styles.SelectedItem?.ToString();if (styleId is null) return;
        var style = document.Model["prepared"]!.AsArray().FirstOrDefault(x => x!["id"]!.GetValue<string>() == styleId);if (style is null) return;
        filling = true;try { name.Text = style["name"]!.GetValue<string>();foreach (var (key, control) in styleNumbers) control.Value = style[key]!.GetValue<int>();replaceBase.Checked = style["damageBonusAtMilestoneReplacesBase"]!.GetValue<bool>(); }
        finally { filling = false; }
    }
    private void Apply()
    {
        xpGrid.EndEdit();if (!draft) return;
        var root = document.Model;var max = (int)numeric["maxLevel"].Value;root["maxLevel"] = max;root["trainingGoldPerLevel"] = (int)numeric["trainingGoldPerLevel"].Value;
        foreach (var key in new[] { "base", "veteranLevel", "veteranBonus" }) root["proficiency"]![key] = (int)numeric["proficiency." + key].Value;
        foreach (var key in new[] { "preparedMilestoneLevel", "preparedVeteranLevel" }) root[key] = (int)numeric[key].Value;
        var curve = new JsonArray();for (var level = 0; level <= max; level++)
        { if (!int.TryParse(xpGrid.Rows[level].Cells[1].Value?.ToString(), out var xp)) throw new ManifestException("E_XP", $"$.xpThresholds[{level}]", "Enter an integer XP value.");curve.Add(xp); }
        root["xpThresholds"] = curve;var array = new JsonArray();foreach (var level in milestones.CheckedItems.Cast<int>())array.Add(level);root["attributeMilestoneLevels"] = array;
        foreach (var key in new[] { "device_training.rangedAccuracy", "device_training.rangedVeteranAccuracy", "device_training.rangedMilestoneDamage", "thornhide.reflectAtMilestone" })
        { var parts = key.Split('.');root["traitBonuses"]![parts[0]]![parts[1]] = (int)numeric["trait." + key].Value; }
        if (styleId is not null)
        {
            var style = root["prepared"]!.AsArray().First(x => x!["id"]!.GetValue<string>() == styleId)!;
            style["name"] = name.Text.Trim();foreach (var (key, value) in styleNumbers)style[key] = (int)value.Value;
            style["damageBonusAtMilestoneReplacesBase"] = replaceBase.Checked;
        }
        ProgressionDatabaseReader.Validate(root);document.Apply(root.ToJsonString());draft = false;UpdateStatus();
    }
    private bool ResolveDraft()
    {
        if (!draft) return true;
        var result = MessageBox.Show(this, "Apply unsaved field edits?", "Progression draft", MessageBoxButtons.YesNoCancel);
        if (result == DialogResult.Cancel) return false;if (result == DialogResult.Yes) Apply();else RefreshForm();return true;
    }
    private void Undo() { if (!ResolveDraft()) return;document.Undo();RefreshForm(); }
    private void Redo() { if (!ResolveDraft()) return;document.Redo();RefreshForm(); }
    private void Save() { if (!ResolveDraft()) return;document.Save();UpdateStatus(); }
    private void UpdateStatus() { status.Text = document.HasExternalChange ? "External file change detected — save will block" : document.IsDirty ? "Accepted changes not saved" : draft ? "Unapplied field edits" : "Saved"; }
    private void Closing(object? sender, FormClosingEventArgs e)
    {
        if (!ResolveDraft()) { e.Cancel = true;return; }if (!document.IsDirty) return;
        var result = MessageBox.Show(this, "Save progression edits before closing?", "Unsaved progression", MessageBoxButtons.YesNoCancel);
        if (result == DialogResult.Cancel) { e.Cancel = true;return; }
        if (result == DialogResult.Yes) try { Save(); } catch (Exception error) { MessageBox.Show(this, error.Message, "Save failed");e.Cancel = true; }
    }
    protected override bool ProcessCmdKey(ref Message message, Keys key)
    {
        if (key == (Keys.Control | Keys.S)) { Safe(Save);return true; }
        if (key == (Keys.Control | Keys.Z)) { Safe(Undo);return true; }
        if (key == (Keys.Control | Keys.Y)) { Safe(Redo);return true; }
        return base.ProcessCmdKey(ref message, key);
    }
}

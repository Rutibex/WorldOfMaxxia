using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

/// <summary>MM08 actor, portrait-set and starter-roster editor. All changes are accepted into an undoable document, not game saves.</summary>
public sealed class ActorsDatabaseForm : Form
{
    private sealed record ActorRow(string Id, string Name) { public override string ToString() => $"{Name}  [{Id}]"; }
    private sealed record NamedId(string Id, string Label) { public override string ToString() => Label + "  [" + Id + "]"; }
    private readonly ActorDatabaseDocument document;
    private readonly ListBox actors = new() { Dock = DockStyle.Fill, IntegralHeight = false };
    private readonly ListBox party = new() { Dock = DockStyle.Fill, IntegralHeight = false };
    private readonly TextBox search = new() { Dock = DockStyle.Top, PlaceholderText = "Search actors by name or ID" };
    private readonly TextBox id = new() { ReadOnly = true }, name = new() { MaxLength = 24 }, heritage = new() { MaxLength = 100 };
    private readonly ComboBox cls = new() { DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly ComboBox portrait = new() { DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly ComboBox attack = new() { DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly NumericUpDown age = new() { Minimum = 1, Maximum = 999 };
    private readonly Dictionary<string, NumericUpDown> stats = new();
    private readonly Dictionary<string, ComboBox> gear = new();
    private readonly PictureBox[] portraitViews = Enumerable.Range(0, 4).Select(_ => new PictureBox { Width = 86, Height = 100, SizeMode = PictureBoxSizeMode.Zoom, BorderStyle = BorderStyle.FixedSingle }).ToArray();
    private readonly Label status = new() { AutoSize = true };
    private readonly ListBox portraitList = new() { Dock = DockStyle.Left, Width = 250 };
    private readonly TextBox portraitLabel = new() { MaxLength = 100, Width = 370 };
    private readonly Dictionary<string, ComboBox> portraitStates = new();
    private string? selectedPortraitId;
    private bool selectingPortrait;

    private readonly Dictionary<string, ResourceRecord> images;
    private readonly HashSet<string> baseActors = ["hero_tarin", "hero_vexa", "hero_brindle", "hero_orrin", "hero_sera", "hero_mora"];
    private readonly string projectRoot;
    private string? selectedId;
    private bool filling, draft;
    private readonly List<Bitmap> previewBitmaps = [];

    public ActorsDatabaseForm(string manifestFile, ProjectManifest manifest)
    {
        if (manifest.Content.Actors is not { Length: > 0 } path)
            throw new ManifestException("E_ACTORS", "$.content.actors", "Project does not declare an actors database.");
        projectRoot = Path.GetDirectoryName(Path.GetFullPath(manifestFile))!;
        var file = Path.GetFullPath(Path.Combine(projectRoot, path.Replace('/', Path.DirectorySeparatorChar)));
        if (!file.StartsWith(projectRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new ManifestException("E_ACTORS_PATH", "$.content.actors", "Actors database must be inside the project folder.");
        document = new ActorDatabaseDocument(file);
        images = ResourceCatalogReader.Read(manifestFile, manifest)?.Resources.Where(r => r.Kind == "image")
            .ToDictionary(r => r.Id, StringComparer.Ordinal) ?? new Dictionary<string, ResourceRecord>();
        if (manifest.Content.Classes is { Length: > 0 } classesPath)
        {
            var classesFile = Path.GetFullPath(Path.Combine(projectRoot, classesPath.Replace('/', Path.DirectorySeparatorChar)));
            if (File.Exists(classesFile))
                foreach (var c in ClassDatabaseReader.Read(File.ReadAllText(classesFile))["classes"]!.AsArray())
                    cls.Items.Add(new NamedId(c!["id"]!.GetValue<string>(), c["name"]!.GetValue<string>()));
        }
        if (cls.Items.Count == 0) throw new ManifestException("E_ACTOR_CLASSES", "$.content.classes", "Edit actors after declaring a valid classes database.");
        var items = new List<JsonNode>();
        if (manifest.Content.Items is { Length: > 0 } itemsPath)
        {
            var itemFile = Path.GetFullPath(Path.Combine(projectRoot, itemsPath.Replace('/', Path.DirectorySeparatorChar)));
            if (File.Exists(itemFile)) items.AddRange(ItemDatabaseReader.Read(File.ReadAllText(itemFile))["items"]!.AsArray().Where(v => v is not null).Select(v => v!));
        }
        Text = "Maxxia Maker — Actors, portraits and starting party";
        ClientSize = new Size(1220, 850);MinimumSize = new Size(900, 650);Font = new Font("Segoe UI", 9.5f);
        StartPosition = FormStartPosition.CenterParent;AutoScaleMode = AutoScaleMode.Dpi;
        var outer = new SplitContainer { Dock = DockStyle.Fill, SplitterDistance = 290, Panel1MinSize = 205, Panel2MinSize = 540 };
        var left = new Panel { Dock = DockStyle.Fill };
        var actions = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 70, WrapContents = true };
        Button Button(string caption, Action fn, Control target)
        {
            var control = new Button { Text = caption, AutoSize = true, MinimumSize = new Size(72, 29) };
            control.Click += (_, _) => Safe(fn);target.Controls.Add(control);return control;
        }
        Button("New", Create, actions);Button("Duplicate", Duplicate, actions);Button("Delete", Delete, actions);
        left.Controls.Add(actors);left.Controls.Add(search);left.Controls.Add(actions);outer.Panel1.Controls.Add(left);
        var tabs = new TabControl { Dock = DockStyle.Fill };
        var details = new TabPage("Actor details");var  lineup = new TabPage("Starting party");var  portraitsPage = new TabPage("Portrait sets");
        tabs.TabPages.AddRange([details, lineup, portraitsPage]);
        var table = new TableLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, ColumnCount = 4, Padding = new Padding(12) };
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 133));table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 133));table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        void Field(string label, Control ctrl, int row, int col)
        {
            table.Controls.Add(new Label { Text = label, Dock = DockStyle.Fill, AutoSize = true }, col, row);
            ctrl.Dock = DockStyle.Fill;ctrl.Margin = new Padding(3, 3, 8, 4);table.Controls.Add(ctrl, col + 1, row);
            switch (ctrl) { case TextBox t: t.TextChanged += (_, _) => Draft();break; case NumericUpDown n: n.ValueChanged += (_, _) => Draft();break;case ComboBox cb: cb.SelectedIndexChanged += (_, _) => { Draft(); Preview(); };break; }
        }
        Field("Stable actor ID", id, 0, 0); Field("Display name", name, 0, 2);
        Field("Class", cls, 1, 0); Field("Portrait set", portrait, 1, 2);
        Field("Age", age, 2, 0); Field("Heritage", heritage, 2, 2);
        for (int n = 0; n < ActorDatabaseReader.Attributes.Length; n++)
        {
            var key = ActorDatabaseReader.Attributes[n];var num = new NumericUpDown { Minimum = 1, Maximum = 18 };
            stats[key] = num;Field(key, num, 3 + n / 2, n % 2 == 0 ? 0 : 2);
        }
        foreach (var slot in ActorDatabaseReader.EquipmentSlots)
        {
            var box = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
            box.Items.Add(new NamedId("", "None"));
            foreach (var item in items.Where(x => x["slot"]?.GetValue<string>() == slot))
                box.Items.Add(new NamedId(item["id"]!.GetValue<string>(), item["name"]!.GetValue<string>()));
            gear[slot] = box;
        }
        Field("Starting melee", gear["melee"], 6, 0);Field("Starting ranged", gear["ranged"], 6, 2);
        Field("Starting armor", gear["body"], 7, 0);Field("Starting offhand", gear["offhand"], 7, 2);
        attack.Items.AddRange(["melee", "ranged"]);Field("Preferred attack", attack, 8, 0);
        var preview = new FlowLayoutPanel { Dock = DockStyle.Fill, Height = 137, AutoSize = true };
        for (int i = 0; i < 4; i++)
        {
            var pair = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoSize = true };
            pair.Controls.Add(portraitViews[i]);pair.Controls.Add(new Label { Text = ActorDatabaseReader.States[i], AutoSize = true });preview.Controls.Add(pair);
        }
        table.Controls.Add(new Label { Text = "Portrait condition states", AutoSize = true }, 0, 9);
        table.Controls.Add(preview, 1, 9);table.SetColumnSpan(preview, 3);
        details.Controls.Add(table);
        var partyLayout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(18), ColumnCount = 2 };
        partyLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 80));partyLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 20));
        var instructions = new Label { Text = "Order 1–6 starting actors. Changes are written into actors.json; old project manifest overrides remain supported. This does not change existing saved parties.", Dock = DockStyle.Top, AutoSize = true, MaximumSize = new Size(680, 0) };
        partyLayout.Controls.Add(instructions, 0, 0);partyLayout.SetColumnSpan(instructions, 2);
        partyLayout.Controls.Add(party, 0, 1);
        var partyButtons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, AutoSize = true };
        Button("Add selected", AddToParty, partyButtons);Button("Remove", RemoveFromParty, partyButtons);
        Button("Move up", () => MoveParty(-1), partyButtons);Button("Move down", () => MoveParty(1), partyButtons);
        partyLayout.Controls.Add(partyButtons, 1, 1);lineup.Controls.Add(partyLayout);
        var portraitEditor = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12) };
        var statePanel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, AutoScroll = true, Padding = new Padding(12) };
        statePanel.Controls.Add(new Label { Text = "Choose catalogue image resources for the four portrait states. Image cropping and animation editing arrive in MM22.", AutoSize = true, MaximumSize = new Size(500, 0) });
        statePanel.Controls.Add(new Label { Text = "Portrait name", AutoSize = true });statePanel.Controls.Add(portraitLabel);
        foreach (var state in ActorDatabaseReader.States)
        {
            statePanel.Controls.Add(new Label { Text = state + " image resource", AutoSize = true });
            var picker = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Width = 440 };
            foreach (var image in images.Values.OrderBy(x => x.Name))
                picker.Items.Add(new NamedId(image.Id, image.Name + (image.Exists ? "" : " [missing]")));
            statePanel.Controls.Add(picker);portraitStates.Add(state, picker);
        }
        var portraitActions = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 84, AutoScroll = true };
        Button("New portrait", CreatePortrait, portraitActions);Button("Duplicate", DuplicatePortrait, portraitActions);
        Button("Delete", DeletePortrait, portraitActions);Button("Apply portrait", ApplyPortrait, portraitActions);
        var portraitLeft = new Panel { Dock = DockStyle.Left, Width = 270 };
        portraitLeft.Controls.Add(portraitList);portraitLeft.Controls.Add(portraitActions);
        portraitEditor.Controls.Add(statePanel);portraitEditor.Controls.Add(portraitLeft);
        portraitsPage.Controls.Add(portraitEditor);
        portraitList.SelectedIndexChanged += (_, _) => { if (!selectingPortrait) Safe(SelectPortrait); };
        RefreshPortraits();
        outer.Panel2.Controls.Add(tabs);
        var bar = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 45, Padding = new Padding(3), FlowDirection = FlowDirection.RightToLeft };
        Button("Close", Close, bar);Button("Save actors", Save, bar);Button("Apply changes", Apply, bar);
        Button("Undo", Undo, bar);Button("Redo", Redo, bar);
        var footer = new StatusStrip();footer.Items.Add(new ToolStripControlHost(status));
        Controls.Add(outer);Controls.Add(bar);Controls.Add(footer);
        search.TextChanged += (_, _) => RefreshActors(selectedId);
        actors.SelectedIndexChanged += (_, _) => { if (!filling) Safe(SelectedChanged); };
        FormClosing += Closing;
        FormClosed += (_, _) => ClearPreviews();
        RefreshActors();RefreshParty();
    }
    private static string Selected(ComboBox box) => (box.SelectedItem as NamedId)?.Id ?? "";
    private static void Choose(ComboBox box, string? id)
    {
        var selection = box.Items.Cast<object>().OfType<NamedId>().ToList().FindIndex(v => v.Id == (id ?? ""));
        box.SelectedIndex = selection >= 0 ? selection : 0;
    }
    private void ClearPreviews()
    {
        foreach (var picture in portraitViews) picture.Image = null;
        foreach (var bitmap in previewBitmaps) bitmap.Dispose();previewBitmaps.Clear();
    }
    private void Preview()
    {
        ClearPreviews();if (portrait.SelectedItem is not NamedId row) return;
        var set = document.Model["portraits"]!.AsArray().FirstOrDefault(x => x!["id"]!.GetValue<string>() == row.Id);
        if (set is null) return;
        for (var i = 0; i < ActorDatabaseReader.States.Length; i++)
        {
            var state = ActorDatabaseReader.States[i];var resourceId = set["states"]![state]!.GetValue<string>();
            if (!images.TryGetValue(resourceId, out var item) || !item.Exists) continue;
            try { using var original = Image.FromFile(item.FilePath);var clone = new Bitmap(original);previewBitmaps.Add(clone);portraitViews[i].Image = clone; }
            catch (Exception e) when (e is ArgumentException or IOException or OutOfMemoryException) { /* Diagnostics remain in resource browser. */ }
        }
    }
    private JsonObject? Current() => document.Model["actors"]!.AsArray().FirstOrDefault(a => a!["id"]?.GetValue<string>() == selectedId)?.AsObject();
    private void RefreshActors(string? focus = null)
    {
        filling = true;actors.Items.Clear();
        foreach (var a in document.Model["actors"]!.AsArray())
        {
            var row = new ActorRow(a!["id"]!.GetValue<string>(), a["name"]!.GetValue<string>());
            if (row.Id.Contains(search.Text, StringComparison.OrdinalIgnoreCase) || row.Name.Contains(search.Text, StringComparison.OrdinalIgnoreCase)) actors.Items.Add(row);
        }
        var wanted = focus ?? selectedId;actors.SelectedItem = actors.Items.Cast<ActorRow>().FirstOrDefault(r => r.Id == wanted) ?? actors.Items.Cast<ActorRow>().FirstOrDefault();
        selectedId = (actors.SelectedItem as ActorRow)?.Id;Fill();filling = false;UpdateStatus();
    }
    private void Fill()
    {
        filling = true;var a = Current();
        if (a is not null)
        {
            id.Text = a["id"]!.GetValue<string>();name.Text = a["name"]!.GetValue<string>();heritage.Text = a["heritage"]?.GetValue<string>() ?? "";
            age.Value = a["age"]!.GetValue<int>();Choose(cls, a["classId"]!.GetValue<string>());Choose(portrait, a["portraitId"]!.GetValue<string>());
            foreach (var stat in stats) stat.Value.Value = a["attributes"]![stat.Key]!.GetValue<int>();
            foreach (var slot in gear) Choose(slot.Value, a["equipment"]![slot.Key]?.GetValue<string>());
            attack.SelectedItem = a["equipment"]!["preferredAttack"]!.GetValue<string>();
        }
        filling = false;draft = false;Preview();UpdateStatus();
    }
    private void UpdateStatus() => status.Text = $"{document.Model["actors"]!.AsArray().Count} actors · {(document.IsDirty ? "unsaved" : "saved")} · {(draft ? "unapplied form" : "accepted")} · Ctrl+S saves";
    private void Draft() { if (!filling) { draft = true;UpdateStatus(); } }
    private void Safe(Action action) { try { action(); } catch (Exception e) { MessageBox.Show(this, e.Message, "Actors database", MessageBoxButtons.OK, MessageBoxIcon.Warning); } }
    private bool ResolveDraft()
    {
        if (!draft) return true;
        var choice = MessageBox.Show(this, "Apply pending actor details?", "Unapplied changes", MessageBoxButtons.YesNoCancel);
        if (choice == DialogResult.Cancel) return false;
        if (choice == DialogResult.Yes) Apply();else Fill();return true;
    }
    private void SelectedChanged()
    {
        var next = (actors.SelectedItem as ActorRow)?.Id;
        if (!ResolveDraft()) { RefreshActors(selectedId);return; }
        selectedId = next;Fill();
    }
    private void Apply()
    {
        var old = Current();if (old is null) return;
        var root = document.Model;var record = (JsonObject)old.DeepClone();
        record["name"] = name.Text.Trim();record["classId"] = Selected(cls);record["portraitId"] = Selected(portrait);
        var set = root["portraits"]!.AsArray().First(p => p!["id"]!.GetValue<string>() == Selected(portrait));
        record["portrait"] = set!["legacyIndex"]?.GetValue<int>() ?? 0;
        record["age"] = (int)age.Value;record["heritage"] = heritage.Text;
        foreach (var stat in stats) record["attributes"]![stat.Key] = (int)stat.Value.Value;
        foreach (var item in gear) record["equipment"]![item.Key] = Selected(item.Value) is { Length: > 0 } value ? JsonValue.Create(value) : null;
        record["equipment"]!["preferredAttack"] = attack.SelectedItem?.ToString() ?? "melee";
        var array = root["actors"]!.AsArray();var index = array.ToList().FindIndex(x => x?["id"]?.GetValue<string>() == selectedId);
        if (index < 0) return;
        array[index] = record;ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());draft = false;RefreshActors(selectedId);
    }
    private void RefreshPortraits(string? focus = null)
    {
        selectingPortrait = true;
        portraitList.Items.Clear();portrait.Items.Clear();
        foreach (var p in document.Model["portraits"]!.AsArray())
        {
            var row = new NamedId(p!["id"]!.GetValue<string>(), p["name"]!.GetValue<string>());
            portraitList.Items.Add(row);portrait.Items.Add(row);
        }
        var wanted = focus ?? selectedPortraitId;
        portraitList.SelectedItem = portraitList.Items.Cast<NamedId>().FirstOrDefault(p => p.Id == wanted) ?? portraitList.Items.Cast<NamedId>().FirstOrDefault();
        selectedPortraitId = (portraitList.SelectedItem as NamedId)?.Id;
        FillPortrait();selectingPortrait = false;
    }
    private void SelectPortrait()
    {
        selectedPortraitId = (portraitList.SelectedItem as NamedId)?.Id;FillPortrait();
    }
    private void FillPortrait()
    {
        var node = document.Model["portraits"]!.AsArray().FirstOrDefault(p => p?["id"]?.GetValue<string>() == selectedPortraitId);
        if (node is null) return;
        portraitLabel.Text = node["name"]!.GetValue<string>();
        foreach (var state in ActorDatabaseReader.States) Choose(portraitStates[state], node["states"]![state]!.GetValue<string>());
    }
    private void ApplyPortrait()
    {
        if (!ResolveDraft() || selectedPortraitId is null) return;
        var root = document.Model;var portraits = root["portraits"]!.AsArray();
        var i = portraits.ToList().FindIndex(p => p?["id"]?.GetValue<string>() == selectedPortraitId);
        if (i < 0) return;var updated = (JsonObject)portraits[i]!.DeepClone();updated["name"] = portraitLabel.Text.Trim();
        foreach (var state in ActorDatabaseReader.States)
        {
            var id = Selected(portraitStates[state]);
            if (!images.TryGetValue(id, out var resource) || resource.Kind != "image" || !resource.Exists)
                throw new ManifestException("E_PORTRAIT_ASSET", "$.portraits", "Select an available image for " + state + ".");
            updated["states"]![state] = id;
        }
        portraits[i] = updated;ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());
        RefreshPortraits(selectedPortraitId);RefreshActors(selectedId);
    }
    private void CreatePortrait()
    {
        if (!ResolveDraft()) return;
        var root = document.Model;var copy = (JsonObject)root["portraits"]!.AsArray().First()!.DeepClone();
        var id = "portrait_" + Guid.NewGuid().ToString("N");copy["id"] = id;copy["name"] = "New Portrait";copy.Remove("legacyIndex");
        root["portraits"]!.AsArray().Add(copy);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());RefreshPortraits(id);
    }
    private void DuplicatePortrait()
    {
        if (!ResolveDraft() || selectedPortraitId is null) return;
        var root = document.Model;var current = root["portraits"]!.AsArray().First(x => x?["id"]?.GetValue<string>() == selectedPortraitId)!;
        var copy = (JsonObject)current.DeepClone();var id = "portrait_" + Guid.NewGuid().ToString("N");
        copy["id"] = id;copy["name"] = (current["name"]!.GetValue<string>() + " Copy")[..Math.Min(100, current["name"]!.GetValue<string>().Length + 5)];copy.Remove("legacyIndex");
        root["portraits"]!.AsArray().Add(copy);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());RefreshPortraits(id);
    }
    private void DeletePortrait()
    {
        if (!ResolveDraft() || selectedPortraitId is null) return;
        var root = document.Model;var sets = root["portraits"]!.AsArray();var i = sets.ToList().FindIndex(p => p?["id"]?.GetValue<string>() == selectedPortraitId);
        if (i < 0) return;
        if (sets[i]!["legacyIndex"] is not null) { MessageBox.Show(this, "Legacy portrait sets are protected for existing saves.");return; }
        if (root["actors"]!.AsArray().Any(a => a?["portraitId"]?.GetValue<string>() == selectedPortraitId))
        { MessageBox.Show(this, "Reassign actors using this portrait before deleting it.");return; }
        if (MessageBox.Show(this, "Delete this portrait set?", "Confirm", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
        sets.RemoveAt(i);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());selectedPortraitId = null;RefreshPortraits();RefreshActors(selectedId);
    }
    private void Create()
    {
        if (!ResolveDraft()) return;
        var root = document.Model;var id = ActorDatabaseReader.NewActorId();
        var source = root["actors"]!.AsArray().First()!;
        var duplicate = (JsonObject)source.DeepClone();duplicate["id"] = id;duplicate["name"] = "New Adventurer";
        root["actors"]!.AsArray().Add(duplicate);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());search.Text = "";RefreshActors(id);
    }
    private void Duplicate()
    {
        if (!ResolveDraft() || Current() is not { } original) return;
        var root = document.Model;var id = ActorDatabaseReader.NewActorId();var copy = (JsonObject)original.DeepClone();
        copy["id"] = id;copy["name"] = (original["name"]!.GetValue<string>() + " Copy")[..Math.Min(24, original["name"]!.GetValue<string>().Length + 5)];
        root["actors"]!.AsArray().Add(copy);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());search.Text = "";RefreshActors(id);
    }
    private void Delete()
    {
        if (!ResolveDraft() || selectedId is null) return;
        if (baseActors.Contains(selectedId)) { MessageBox.Show(this, "Original actor IDs are protected until legacy save migration (MM35).", "Protected actor");return; }
        var root = document.Model;
        if (root["startingParty"]!.AsArray().Any(x => x?.GetValue<string>() == selectedId)) { MessageBox.Show(this, "Remove this actor from the starting party before deleting.");return; }
        if (MessageBox.Show(this, "Delete this actor? Existing saves may still refer to its ID.", "Confirm", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
        var records = root["actors"]!.AsArray();var index = records.ToList().FindIndex(x => x?["id"]?.GetValue<string>() == selectedId);
        if (index < 0) return;records.RemoveAt(index);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());selectedId = null;RefreshActors();
    }
    private void RefreshParty(string? focus = null)
    {
        party.Items.Clear();var root = document.Model;
        foreach (var entry in root["startingParty"]!.AsArray())
        {
            var id = entry!.GetValue<string>();var a = root["actors"]!.AsArray().FirstOrDefault(x => x!["id"]!.GetValue<string>() == id);
            party.Items.Add(new ActorRow(id, a?["name"]?.GetValue<string>() ?? id));
        }
        party.SelectedItem = party.Items.Cast<ActorRow>().FirstOrDefault(x => x.Id == focus);
    }
    private void AddToParty()
    {
        if (!ResolveDraft() || selectedId is null) return;
        var root = document.Model;var starters = root["startingParty"]!.AsArray();
        if (starters.Count >= 6 || starters.Any(x => x?.GetValue<string>() == selectedId)) return;
        starters.Add(selectedId);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());RefreshParty(selectedId);UpdateStatus();
    }
    private void RemoveFromParty()
    {
        if (!ResolveDraft() || party.SelectedItem is not ActorRow row) return;
        var root = document.Model;var starters = root["startingParty"]!.AsArray();
        if (starters.Count < 2) { MessageBox.Show(this, "The starting party must contain at least one actor.");return; }
        var index = starters.ToList().FindIndex(x => x?.GetValue<string>() == row.Id);
        if (index < 0) return;starters.RemoveAt(index);ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());RefreshParty();UpdateStatus();
    }
    private void MoveParty(int delta)
    {
        if (!ResolveDraft() || party.SelectedItem is not ActorRow row) return;
        var root = document.Model;var starters = root["startingParty"]!.AsArray();
        var first = starters.ToList().FindIndex(x => x?.GetValue<string>() == row.Id);var second = first + delta;
        if (second < 0 || second >= starters.Count) return;
        var moved = starters[first]!.DeepClone();var replaced = starters[second]!.DeepClone();
        starters[first] = replaced;starters[second] = moved;ActorDatabaseReader.Validate(root);document.Apply(root.ToJsonString());RefreshParty(row.Id);UpdateStatus();
    }
    private void Undo() { if (!ResolveDraft()) return;document.Undo();RefreshPortraits();RefreshActors(selectedId);RefreshParty(); }
    private void Redo() { if (!ResolveDraft()) return;document.Redo();RefreshPortraits();RefreshActors(selectedId);RefreshParty(); }
    private void Save() { if (!ResolveDraft()) return;document.Save();UpdateStatus(); }
    private void Closing(object? sender, FormClosingEventArgs e)
    {
        if (!ResolveDraft()) { e.Cancel = true;return; }
        if (!document.IsDirty) return;
        var action = MessageBox.Show(this, "Save actor edits before closing?", "Unsaved actors", MessageBoxButtons.YesNoCancel);
        if (action == DialogResult.Cancel) { e.Cancel = true;return; }
        if (action == DialogResult.Yes) try { Save(); } catch (Exception error) { MessageBox.Show(this, error.Message, "Save failed");e.Cancel = true; }
    }
    protected override bool ProcessCmdKey(ref Message message, Keys key)
    {
        if (key == (Keys.Control | Keys.S)) { Safe(Save);return true; }
        if (key == (Keys.Control | Keys.Z)) { Safe(Undo);return true; }
        if (key == (Keys.Control | Keys.Y)) { Safe(Redo);return true; }
        return base.ProcessCmdKey(ref message, key);
    }
}

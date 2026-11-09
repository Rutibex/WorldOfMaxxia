using System.Diagnostics;
using System.Reflection;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

public sealed class MainForm : Form
{
    private readonly DocumentWorkspace workspace = new();
    private readonly TabControl tabs = new() { Dock = DockStyle.Fill };
    private readonly TreeView projects = new() { Dock = DockStyle.Fill, HideSelection = false };
    private readonly ListView records = new() { Dock = DockStyle.Bottom, Height = 180, View = View.Details, FullRowSelect = true };
    private readonly ListView diagnostics = new() { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true };
    private readonly ToolStripStatusLabel status = new();
    private readonly Dictionary<ProjectDocument, ProjectDocumentView> views = [];
    private readonly Dictionary<ProjectDocument, DocumentDiagnostic> errors = [];
    private readonly System.Windows.Forms.Timer poll = new() { Interval = 2000 };
    private readonly ToolStripMenuItem save = new("&Save"), saveAll = new("Save &all"), undo = new("&Undo"), redo = new("&Redo");
    private bool refreshing;
    private DocumentDiagnostic? globalError;
    private static string BuildVersion => typeof(MainForm).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";
    private ProjectDocumentView? Active => tabs.SelectedTab?.Tag as ProjectDocumentView;

    public MainForm()
    {
        Text = $"Maxxia Maker — MM17 — {BuildVersion}"; StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1180, 800); MinimumSize = new Size(850, 600); AutoScaleMode = AutoScaleMode.Dpi; Font = new Font("Segoe UI", 10F);
        var menu = new MenuStrip(); var file = new ToolStripMenuItem("&File"); var edit = new ToolStripMenuItem("&Edit"); var help = new ToolStripMenuItem("&Help");
        void Item(ToolStripMenuItem parent, string label, Keys keys, Action action)
        {
            var item = new ToolStripMenuItem(label) { ShortcutKeys = keys }; item.Click += (_, _) => Guard(action); parent.DropDownItems.Add(item);
        }
        Item(file, "&Open project…", Keys.Control | Keys.O, OpenProject);
        save.ShortcutKeys = Keys.Control | Keys.S; save.Click += (_, _) => Guard(SaveActive); file.DropDownItems.Add(save);
        saveAll.ShortcutKeys = Keys.Control | Keys.Shift | Keys.S; saveAll.Click += (_, _) => Guard(SaveAll); file.DropDownItems.Add(saveAll);
        Item(file, "Save &copy…", Keys.None, () => ExportActive(false)); Item(file, "Clone as &new game…", Keys.None, () => ExportActive(true));
        Item(file, "&Reload from disk", Keys.None, ReloadActive); Item(file, "&Close project", Keys.Control | Keys.W, CloseActive);
        file.DropDownItems.Add(new ToolStripSeparator()); Item(file, "E&xit", Keys.Alt | Keys.F4, Close);
        undo.ShortcutKeys = Keys.Control | Keys.Z; undo.Click += (_, _) => Active?.UndoAccepted(); edit.DropDownItems.Add(undo);
        redo.ShortcutKeys = Keys.Control | Keys.Y; redo.Click += (_, _) => Active?.RedoAccepted(); edit.DropDownItems.Add(redo);
        Item(edit, "Project &settings…", Keys.None, () => Active?.EditSettings());
        Item(edit, "&Resource catalogue…", Keys.Control | Keys.R, OpenResources);
        Item(edit, "&Items database…", Keys.Control | Keys.I, OpenItems);
        Item(edit, "&Classes database…", Keys.Control | Keys.K, OpenClasses);
        Item(edit, "&Actors database…", Keys.Control | Keys.H, OpenActors);
        Item(edit, "&Progression and abilities…", Keys.Control | Keys.P, OpenProgression);
        Item(edit, "&Spells database…", Keys.Control | Keys.L, OpenSpells);
        Item(edit, "C&onditions database…", Keys.Control | Keys.D, OpenConditions);
        Item(edit, "&Monsters database…", Keys.Control | Keys.M, OpenMonsters);
        Item(edit, "&Encounter groups and placements…", Keys.Control | Keys.E, OpenEncounters);
        Item(edit, "&Loot tables and ground pickups…", Keys.Control | Keys.G, OpenLoot);
        Item(edit, "Validated summary…", Keys.None, () =>
        {
            if (Active is not { } view || !view.ResolveDraft()) return;
            using var inspector = new ManifestInspectorForm(view.Document.FilePath, view.Document.Model);
            inspector.ShowDialog(this);
        });
        Item(help, "Open &documentation", Keys.None, OpenDocumentation);
        Item(help, "&About", Keys.None, () => MessageBox.Show(this, $"Maxxia Maker {BuildVersion}\nWitches Mirror Games\n\nItems/classes/actors/progression/spells/conditions/monsters/encounters/loot database editor, resource browser, safe save and undo.\nGame engine {ManifestContract.CurrentEngineVersion}.", "About"));
        menu.Items.AddRange([file, edit, help]); MainMenuStrip = menu;
        var tools = new ToolStrip();
        void Tool(string label, Action action) { var button = new ToolStripButton(label); button.Click += (_, _) => Guard(action); tools.Items.Add(button); }
        Tool("Maps", () => OpenMaps()); Tool("Open", OpenProject); Tool("Save", SaveActive); Tool("Save All", SaveAll); Tool("Undo", () => Active?.UndoAccepted()); Tool("Redo", () => Active?.RedoAccepted()); Tool("Project settings", () => Active?.EditSettings()); Tool("Resources", OpenResources); Tool("Items database", OpenItems); Tool("Classes database", OpenClasses); Tool("Actors database", OpenActors); Tool("Progression", OpenProgression); Tool("Monsters", OpenMonsters); Tool("Encounters", OpenEncounters); Tool("Loot", OpenLoot);
        records.Columns.Add("Type", 70); records.Columns.Add("Record ID", 190);
        diagnostics.Columns.Add("Code", 130); diagnostics.Columns.Add("Document / field", 260); diagnostics.Columns.Add("Message", 700);
        var top = new SplitContainer { Size = new Size(1160, 600), Dock = DockStyle.Fill, SplitterDistance = 260, Panel1MinSize = 180, Panel2MinSize = 400 };
        top.Panel1.Controls.Add(projects); top.Panel1.Controls.Add(records); top.Panel2.Controls.Add(tabs);
        var body = new SplitContainer { Size = new Size(1160, 690), Dock = DockStyle.Fill, Orientation = Orientation.Horizontal, SplitterDistance = 510, Panel1MinSize = 250, Panel2MinSize = 100 };
        body.Panel1.Controls.Add(top); body.Panel2.Controls.Add(diagnostics);
        var bar = new StatusStrip(); bar.Items.Add(status);
        var header = new Panel { Dock = DockStyle.Top, Height = 54 }; header.Controls.Add(tools); header.Controls.Add(menu); tools.Dock = DockStyle.Bottom; menu.Dock = DockStyle.Top;
        Controls.Add(body); Controls.Add(bar); Controls.Add(header);
        tabs.SelectedIndexChanged += (_, _) => RefreshWorkspace();
        projects.NodeMouseDoubleClick += (_, e) => { if(e.Node.Tag is ValueTuple<ProjectDocument,string> map){ Activate(map.Item1); Guard(()=>OpenMaps(map.Item2)); } };
        projects.AfterSelect += (_, e) => { if (!refreshing && e.Node?.Tag is ProjectDocument d) Activate(d); };
        records.DoubleClick += (_, _) => { if (records.SelectedItems.Count > 0) Active?.SelectToken(records.SelectedItems[0].SubItems[1].Text); };
        diagnostics.DoubleClick += (_, _) =>
        {
            if (diagnostics.SelectedItems.Count == 0 || diagnostics.SelectedItems[0].Tag is not ProjectDocument doc) return;
            Activate(doc); var location = diagnostics.SelectedItems[0].SubItems[1].Text;
            var field = location.Split('.').Last().Split('[')[0]; if (field.Length > 0) Active?.SelectToken("\"" + field + "\"");
        };
        FormClosing += ClosingWorkspace;
        poll.Tick += (_, _) => RefreshWorkspace(); poll.Start(); RefreshWorkspace();
    }
    protected override void Dispose(bool disposing) { if (disposing) poll.Dispose(); base.Dispose(disposing); }
    private void Guard(Action action)
    {
        try { action(); }
        catch (Exception error) { Report(Active, error); }
    }
    private void Report(ProjectDocumentView? view, Exception error)
    {
        var code = error is ManifestException manifest ? manifest.Code : error is DocumentException doc ? doc.Code : "E_IO";
        var location = error is ManifestException m ? m.Path : view?.Document.FilePath ?? "";
        if (view is not null) errors[view.Document] = new DocumentDiagnostic(code, location, error.Message);
        else globalError = new DocumentDiagnostic(code, (error.Data["sourceFile"] as string ?? "") + " " + location, error.Message);
        RefreshWorkspace(); MessageBox.Show(this, error.Message, "Operation could not complete", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
    private void OpenProject()
    {
        using var dialog = new OpenFileDialog { Title = "Open Maxxia project", Filter = "Maxxia projects (*.maxxia)|*.maxxia", CheckFileExists = true,
            InitialDirectory = Directory.Exists(Path.Combine(AppContext.BaseDirectory, "examples")) ? Path.Combine(AppContext.BaseDirectory, "examples") : AppContext.BaseDirectory };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        try { OpenPath(dialog.FileName); globalError = null; RefreshWorkspace(); }
        catch (Exception error) { error.Data["sourceFile"] = dialog.FileName; Report(null, error); }
    }
    private void OpenPath(string path)
    {
        var doc = workspace.Open(path);
        if (!views.ContainsKey(doc))
        {
            var view = new ProjectDocumentView(doc); views.Add(doc, view);
            view.OperationFailed += Report; view.ViewChanged += (_, _) => { errors.Remove(doc); RefreshWorkspace(); };
            var page = new TabPage { Tag = view }; page.Controls.Add(view); tabs.TabPages.Add(page);
        }
        Activate(doc);
    }
    private void Activate(ProjectDocument document)
    {
        foreach (TabPage page in tabs.TabPages) if (page.Tag is ProjectDocumentView view && view.Document == document) { tabs.SelectedTab = page; break; }
        RefreshWorkspace();
    }
    private void RefreshWorkspace()
    {
        if (refreshing || IsDisposed) return; refreshing = true;
        try
        {
            projects.BeginUpdate(); projects.Nodes.Clear(); diagnostics.Items.Clear(); records.Items.Clear();
            if (globalError is { } global) diagnostics.Items.Add(new ListViewItem([global.Code, global.Location, global.Message]));
            foreach (var doc in workspace.Documents)
            {
                var view = views[doc]; var external = doc.ExternalChange(); var label = Path.GetFileName(doc.FilePath) + (doc.IsDirty ? " *" : "") + (view.HasDraft ? " [draft]" : "") + (external is null ? "" : " !");
                var projectNode = new TreeNode(label) { Tag = doc }; projects.Nodes.Add(projectNode);
                try
                {
                    var folder = new TreeNode("Maps (double-click to edit geometry)"); projectNode.Nodes.Add(folder);
                    foreach (var map in MapIndexReader.Read(doc.FilePath, doc.Model))
                        {
                        var summary = MapDocumentReader.Inspect(map.FilePath);
                        folder.Nodes.Add(new TreeNode(map.DisplayName + $"  [{map.Id}]  {summary.Width}×{summary.Height}")
                        { Tag = (doc, map.Id), ToolTipText = $"{map.FilePath}\n{summary.EnvironmentId} · {summary.ArrivalCount} arrivals, {summary.EventCount} events, {summary.PortalCount} portals" });
                        }
                    if (doc.Model.Content.Actors is { Length: > 0 } actorsPath)
                    {
                        var actorsFile = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(doc.FilePath)!, actorsPath.Replace('/', Path.DirectorySeparatorChar)));
                        if (File.Exists(actorsFile))
                        {
                            var actorsData = ActorDatabaseReader.Read(File.ReadAllText(actorsFile));
                            projectNode.Nodes.Add(new TreeNode($"Actors ({actorsData["actors"]!.AsArray().Count}) [editable]") { ToolTipText = actorsFile });
                        }
                        else Diagnostic(new DocumentDiagnostic("E_ACTOR_DB_MISSING", actorsFile, "Actors database file is missing"));
                    }
                    if (doc.Model.Content.Spells is { Length: > 0 } spellsPath)
                    {
                        var spellFile = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(doc.FilePath)!, spellsPath.Replace('/', Path.DirectorySeparatorChar)));
                        if (File.Exists(spellFile))
                        {
                            var spellData = SpellDatabaseReader.Read(File.ReadAllText(spellFile));
                            projectNode.Nodes.Add(new TreeNode($"Spells ({spellData["spells"]!.AsArray().Count}) [editable]") { ToolTipText = spellFile });
                            if(spellData["conditionsFile"]?.ToString() is { Length: > 0 } conditionFilename)
                            {
                                var conditionFile=Path.Combine(Path.GetDirectoryName(spellFile)!,conditionFilename);
                                if(File.Exists(conditionFile))
                                {
                                    var conditionData=ConditionDatabaseReader.Read(File.ReadAllText(conditionFile));
                                    projectNode.Nodes.Add(new TreeNode($"Conditions ({conditionData["conditions"]!.AsArray().Count}) [editable]"){ToolTipText=conditionFile});
                                }
                                else Diagnostic(new DocumentDiagnostic("E_CONDITION_DB_MISSING",conditionFile,"Conditions database file is missing"));
                            }
                        }
                        else Diagnostic(new DocumentDiagnostic("E_SPELL_DB_MISSING", spellFile, "Spells database file is missing"));
                    }
                    if (doc.Model.Content.Monsters is { Length: > 0 } monstersPath)
                    {
                        var monstersFile=Path.GetFullPath(Path.Combine(Path.GetDirectoryName(doc.FilePath)!,monstersPath.Replace('/',Path.DirectorySeparatorChar)));
                        if(File.Exists(monstersFile))
                        {
                            var monsterData=MonsterDatabaseReader.Read(File.ReadAllText(monstersFile));
                            projectNode.Nodes.Add(new TreeNode($"Monsters ({monsterData["monsters"]!.AsArray().Count}) [editable]"){ToolTipText=monstersFile});
                        }
                        else Diagnostic(new DocumentDiagnostic("E_MONSTER_DB_MISSING",monstersFile,"Monsters database file is missing"));
                    }
                    if (doc.Model.Content.EncounterGroups is { Length: >0 } groupsPath&&doc.Model.Content.EncounterPlacements is { Length: >0 } placementsPath)
                    {
                        var encounterFolder=Path.GetDirectoryName(doc.FilePath)!;
                        var gfile=Path.GetFullPath(Path.Combine(encounterFolder,groupsPath.Replace('/',Path.DirectorySeparatorChar)));
                        var pfile=Path.GetFullPath(Path.Combine(encounterFolder,placementsPath.Replace('/',Path.DirectorySeparatorChar)));
                        if(File.Exists(gfile)&&File.Exists(pfile))
                        {
                            var groups=EncounterDatabaseReader.ReadGroups(File.ReadAllText(gfile));
                            var placements=EncounterDatabaseReader.ReadPlacements(File.ReadAllText(pfile));
                            projectNode.Nodes.Add(new TreeNode($"Encounter groups ({groups["groups"]!.AsArray().Count}) [editable]"){ToolTipText=gfile});
                            projectNode.Nodes.Add(new TreeNode($"Map encounters ({placements["placements"]!.AsArray().Count}) [editable]"){ToolTipText=pfile});
                        }
                        else Diagnostic(new DocumentDiagnostic("E_ENCOUNTER_DB_MISSING",encounterFolder,"Encounter groups or placements file is missing."));
                    }
                    if (doc.Model.Content.Classes is { Length: > 0 } classesPath)
                    {
                        var path = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(doc.FilePath)!, classesPath.Replace('/', Path.DirectorySeparatorChar)));
                        if (File.Exists(path))
                        {
                            var definitions = ClassDatabaseReader.Read(File.ReadAllText(path));
                            projectNode.Nodes.Add(new TreeNode($"Classes ({definitions["classes"]!.AsArray().Count}) [editable]") { ToolTipText = path });
                        }
                        else Diagnostic(new DocumentDiagnostic("E_CLASS_DB_MISSING", path, "Classes database file is missing"));
                    }
                    var resources = ResourceCatalogReader.Read(doc.FilePath, doc.Model);
                    if (resources is not null)
                    {
                        var node = new TreeNode($"Resources ({resources.Resources.Count}) [read-only]"); projectNode.Nodes.Add(node);
                        foreach (var group in resources.Resources.GroupBy(x => x.Kind).OrderBy(x => x.Key))
                            node.Nodes.Add(new TreeNode($"{group.Key} ({group.Count()})"));
                        foreach (var missing in resources.Resources.Where(x => !x.Exists))
                            Diagnostic(new DocumentDiagnostic("E_RESOURCE_MISSING", missing.FilePath, "Missing " + missing.Id));
                    }
                    projectNode.Expand(); folder.Expand();
                }
                catch (Exception e)
                {
                    Diagnostic(new DocumentDiagnostic("E_MAP_INDEX", doc.FilePath, e.Message));
                }
                foreach (TabPage page in tabs.TabPages) if (ReferenceEquals(page.Tag, view)) page.Text = label;
                void Diagnostic(DocumentDiagnostic d) => diagnostics.Items.Add(new ListViewItem([d.Code, d.Location, d.Message]) { Tag = doc });
                if (errors.TryGetValue(doc, out var error)) Diagnostic(error); if (external is not null) Diagnostic(external);
            }
            projects.EndUpdate();
            if (Active is { } active)
            {
                var model = active.Document.Model; records.Items.Add(new ListViewItem(["map", model.Start.Map.Id]));
                foreach (var actor in model.StartingParty) records.Items.Add(new ListViewItem(["actor", actor.Id]));
            }
            save.Enabled = Active is not null; saveAll.Enabled = workspace.Documents.Count > 0;
            undo.Enabled = Active?.Document.CanUndo ?? false; redo.Enabled = Active?.Document.CanRedo ?? false;
            undo.Text = "Undo" + (Active?.Document.CanUndo == true ? " " + Active.Document.UndoLabel : ""); redo.Text = "Redo" + (Active?.Document.CanRedo == true ? " " + Active.Document.RedoLabel : "");
            status.Text = workspace.Documents.Count == 0 ? "Open a project (Ctrl+O). Apply JSON or project settings to create an undoable edit." : $"{workspace.Documents.Count} open • {workspace.Documents.Count(d => d.IsDirty)} unsaved • * accepted changes • [draft] unapplied JSON • ! external change";
        }
        finally { refreshing = false; }
    }
    private void OpenMaps(string? id=null)
    {
        if(Active is not {} view||!view.ResolveDraft())return;
        // Resolve the project snapshot before a modal map session; it cannot drift while the session is open.
        view.Document.Save();
        using var form=new MapsWorkspaceForm(view.Document.FilePath,view.Document.Model,id);
        form.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenItems()
    {
        if (Active is not { } view || !view.ResolveDraft()) return;
        using var editor = new ItemsDatabaseForm(view.Document.FilePath, view.Document.Model);
        editor.ShowDialog(this); RefreshWorkspace();
    }
    private void OpenActors()
    {
        if (Active is not { } view || !view.ResolveDraft()) return;
        using var form = new ActorsDatabaseForm(view.Document.FilePath, view.Document.Model);
        form.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenMonsters()
    {
        if(Active is not { } view||!view.ResolveDraft())return;
        using var editor=new MonstersDatabaseForm(view.Document.FilePath,view.Document.Model);
        editor.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenLoot()
    {
        if(Active is not { } view||!view.ResolveDraft())return;
        using var editor=new LootDatabaseForm(view.Document.FilePath,view.Document.Model);
        editor.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenEncounters()
    {
        if(Active is not { } view||!view.ResolveDraft())return;
        using var editor=new EncountersDatabaseForm(view.Document.FilePath,view.Document.Model);
        editor.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenConditions()
    {
        if(Active is not { } view||!view.ResolveDraft())return;
        using var editor=new ConditionsDatabaseForm(view.Document.FilePath,view.Document.Model);
        editor.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenSpells()
    {
        if (Active is not { } view || !view.ResolveDraft()) return;
        using var editor = new SpellsDatabaseForm(view.Document.FilePath, view.Document.Model);
        editor.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenProgression()
    {
        if (Active is not { } view || !view.ResolveDraft()) return;
        using var editor = new ProgressionDatabaseForm(view.Document.FilePath, view.Document.Model);
        editor.ShowDialog(this);RefreshWorkspace();
    }
    private void OpenClasses()
    {
        if (Active is not { } view || !view.ResolveDraft()) return;
        using var editor = new ClassesDatabaseForm(view.Document.FilePath, view.Document.Model);
        editor.ShowDialog(this); RefreshWorkspace();
    }
    private void OpenResources()
    {
        if (Active is not { } view) return;
        var resources = ResourceCatalogReader.Read(view.Document.FilePath, view.Document.Model);
        if (resources is null) { MessageBox.Show(this, "This legacy project has no resource catalogue. Older asset paths remain supported.", "Resources"); return; }
        using var browser = new ResourceBrowserForm(resources); browser.ShowDialog(this);
    }
    private void SaveActive()
    {
        if (Active is not { } view || !view.ResolveDraft()) return;
        view.Document.Save(); errors.Remove(view.Document); RefreshWorkspace();
    }
    private void SaveAll()
    {
        foreach (var view in views.Values) if (!view.ResolveDraft()) return;
        var result = workspace.SaveAll();
        if (result.Failure is { } error)
        {
            var failed = workspace.Documents.FirstOrDefault(d => AtomicFileStore.PathComparer.Equals(d.FilePath, error.Location));
            if (failed is null) globalError = error; else errors[failed] = error;
            MessageBox.Show(this, $"{result.Saved.Count} saved; {result.Pending.Count} remain unsaved.\n\n{error.Message}", "Save All stopped", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        RefreshWorkspace();
    }
    private void ExportActive(bool clone)
    {
        if (Active is not { } view || !view.ResolveDraft()) return;
        if (clone && MessageBox.Show(this, "Create a new game identity using the same maps and assets? Choose a new filename beside this manifest. Content files remain shared.", "Clone as New Game", MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK) return;
        using var dialog = new SaveFileDialog { Title = clone ? "Clone as New Game" : "Save document copy (same identity)", Filter = "Maxxia project (*.maxxia)|*.maxxia", DefaultExt = "maxxia", AddExtension = true, OverwritePrompt = false,
            InitialDirectory = Path.GetDirectoryName(view.Document.FilePath), FileName = Path.GetFileNameWithoutExtension(view.Document.FilePath) + (clone ? "-clone.maxxia" : "-copy.maxxia") };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        if (clone) { view.Document.CloneAsNewGame(dialog.FileName); OpenPath(dialog.FileName); }
        else view.Document.SaveCopy(dialog.FileName);
        RefreshWorkspace();
    }
    private void ReloadActive()
    {
        if (Active is not { } view) return;
        if ((view.Document.IsDirty || view.HasDraft) && MessageBox.Show(this, "Discard in-memory edits and reload the file?", "Reload project", MessageBoxButtons.OKCancel, MessageBoxIcon.Warning) != DialogResult.OK) return;
        view.Document.Reload(discardChanges: true); errors.Remove(view.Document); RefreshWorkspace();
    }
    private bool PrepareClose(ProjectDocumentView view)
    {
        if (!view.PrepareDraftForClose()) return false;
        if (!view.Document.IsDirty) return true;
        var choice = MessageBox.Show(this, $"Save changes to {Path.GetFileName(view.Document.FilePath)}?", "Close project", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
        if (choice == DialogResult.Cancel) return false;
        if (choice == DialogResult.Yes) { try { view.Document.Save(); } catch (Exception error) { Report(view, error); return false; } }
        return true;
    }
    private void RemoveDocument(ProjectDocumentView view)
    {
        workspace.Close(view.Document, discardChanges: true); views.Remove(view.Document); errors.Remove(view.Document);
        foreach (TabPage page in tabs.TabPages.Cast<TabPage>().ToArray()) if (ReferenceEquals(page.Tag, view)) { tabs.TabPages.Remove(page); page.Dispose(); }
        RefreshWorkspace();
    }
    private void CloseActive() { if (Active is { } view && PrepareClose(view)) RemoveDocument(view); }
    private void ClosingWorkspace(object? sender, FormClosingEventArgs e)
    {
        // Keep all tabs until every close decision succeeds. Cancel cannot discard an earlier tab.
        foreach (var view in views.Values.ToArray()) if (!PrepareClose(view)) { e.Cancel = true; return; }
    }
    private void OpenDocumentation()
    {
        var folder = new DirectoryInfo(AppContext.BaseDirectory);
        while (folder is not null && !Directory.Exists(Path.Combine(folder.FullName, "docs"))) folder = folder.Parent;
        if (folder is null) { MessageBox.Show(this, "Open docs/WORKSPACE.md in the source package.", "Documentation"); return; }
        Process.Start(new ProcessStartInfo(Path.Combine(folder.FullName, "docs")) { UseShellExecute = true });
    }
}

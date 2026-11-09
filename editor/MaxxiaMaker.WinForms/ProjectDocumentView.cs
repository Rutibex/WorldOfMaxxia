using MaxxiaMaker.Documents;

namespace MaxxiaMaker;

public sealed class ProjectDocumentView : UserControl
{
    private readonly TextBox editor = new()
    {
        Dock = DockStyle.Fill, Multiline = true, WordWrap = false, ScrollBars = ScrollBars.Both,
        AcceptsReturn = true, AcceptsTab = true, MaxLength = 200000, Font = new Font("Consolas", 10F)
    };
    private readonly Label summary = new() { Dock = DockStyle.Top, Height = 58, Padding = new Padding(8) };
    private bool syncing;
    public ProjectDocument Document { get; }
    private static string Lines(string text) => text.Replace("\r\n", "\n");
    public bool HasDraft => Lines(editor.Text) != Lines(Document.Text);
    public event EventHandler? ViewChanged;
    public event Action<ProjectDocumentView, Exception>? OperationFailed;

    public ProjectDocumentView(ProjectDocument document)
    {
        Document = document; Dock = DockStyle.Fill;
        var tools = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(5) };
        void Button(string label, Action action) { var b = new Button { Text = label, AutoSize = true }; b.Click += (_, _) => action(); tools.Controls.Add(b); }
        Button("Apply JSON", () => ApplyDraft()); Button("Revert draft", RevertDraft); Button("Project settings…", EditSettings);
        editor.TextChanged += (_, _) => { if (!syncing) ViewChanged?.Invoke(this, EventArgs.Empty); };
        document.Changed += DocumentChanged;
        Controls.Add(editor); Controls.Add(summary); Controls.Add(tools);
        Sync();
    }
    private void DocumentChanged(object? sender, EventArgs e) => Sync();
    protected override void Dispose(bool disposing)
    {
        if (disposing) Document.Changed -= DocumentChanged;
        base.Dispose(disposing);
    }
    private void Sync()
    {
        syncing = true; editor.Text = Lines(Document.Text).Replace("\n", Environment.NewLine); editor.ClearUndo(); syncing = false;
        var model = Document.Model;
        summary.Text = $"{model.Title}  •  {model.ProjectId}\n{Document.FilePath}";
        ViewChanged?.Invoke(this, EventArgs.Empty);
    }
    public bool ApplyDraft()
    {
        try { Document.Apply("Edit manifest JSON", editor.Text); Sync(); return true; }
        catch (Exception error) { OperationFailed?.Invoke(this, error); return false; }
    }
    public void RevertDraft() => Sync();
    public bool ResolveDraft()
    {
        if (!HasDraft) return true;
        var choice = MessageBox.Show(this, "Apply the current JSON draft? Choose No to discard only the unapplied draft.", "Unapplied draft", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
        if (choice == DialogResult.Cancel) return false;
        if (choice == DialogResult.Yes) return ApplyDraft();
        RevertDraft(); return true;
    }
    public bool PrepareDraftForClose()
    {
        if (!HasDraft) return true;
        var choice = MessageBox.Show(this, "Apply the JSON draft before closing? No keeps it in memory until the close completes; Cancel keeps the project open.", "Unapplied draft", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
        if (choice == DialogResult.Cancel) return false;
        return choice != DialogResult.Yes || ApplyDraft();
    }
    public void EditSettings()
    {
        if (!ResolveDraft()) return;
        using var dialog = new ProjectSettingsDialog(Document);
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        try { Document.Apply("Project settings", dialog.EditedJson); Sync(); }
        catch (Exception error) { OperationFailed?.Invoke(this, error); }
    }
    public void UndoAccepted()
    {
        if (HasDraft && !ResolveDraft()) return;
        Document.Undo();
    }
    public void RedoAccepted()
    {
        if (HasDraft && !ResolveDraft()) return;
        Document.Redo();
    }
    public void SelectToken(string token)
    {
        var index = editor.Text.IndexOf(token, StringComparison.Ordinal);
        if (index < 0) return;
        editor.Focus(); editor.Select(index, token.Length); editor.ScrollToCaret();
    }
}

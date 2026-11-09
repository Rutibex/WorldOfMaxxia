using System.Text;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker.Documents;

public sealed record EditSnapshot(string Label, string Before, string After);
public sealed record DocumentDiagnostic(string Code, string Location, string Message);

public sealed class ProjectDocument
{
    private readonly IDocumentStore store;
    private readonly List<EditSnapshot> history = [];
    private int position;
    private string savedText;
    private string fingerprint;
    public string FilePath { get; }
    public string Text { get; private set; }
    public bool IsDirty => Text != savedText;
    public bool CanUndo => position > 0;
    public bool CanRedo => position < history.Count;
    public string UndoLabel => CanUndo ? history[position - 1].Label : "";
    public string RedoLabel => CanRedo ? history[position].Label : "";
    public ProjectManifest Model => ManifestReader.Read(Text); // Return an independent model, never mutable internal state.
    public event EventHandler? Changed;

    internal ProjectDocument(string path, IDocumentStore store)
    {
        FilePath = AtomicFileStore.Normalize(path); this.store = store;
        var loaded = Load(); Text = savedText = loaded.Text; fingerprint = loaded.Fingerprint;
    }
    private (string Text, string Fingerprint) Load()
    {
        var snapshot = store.Read(FilePath);
        string raw;
        try { raw = new UTF8Encoding(false, true).GetString(snapshot.Bytes); }
        catch (DecoderFallbackException) { throw new ManifestException("E_JSON", "$", "Document must be valid UTF-8 JSON."); }
        return (ManifestReader.Serialize(ManifestReader.Read(raw)), snapshot.Fingerprint);
    }
    public bool Apply(string label, string draft)
    {
        var model = ManifestReader.Read(draft);
        if (model.ProjectId != Model.ProjectId) throw new DocumentException("E_IDENTITY", FilePath, "Use Clone as New Game to create a different project identity.");
        var next = ManifestReader.Serialize(model);
        if (next == Text) return false;
        if (position < history.Count) history.RemoveRange(position, history.Count - position);
        history.Add(new EditSnapshot(label, Text, next)); position++;
        if (history.Count > 100) { history.RemoveAt(0); position--; }
        Text = next; Changed?.Invoke(this, EventArgs.Empty); return true;
    }
    public bool Undo()
    {
        if (!CanUndo) return false;
        Text = history[--position].Before; Changed?.Invoke(this, EventArgs.Empty); return true;
    }
    public bool Redo()
    {
        if (!CanRedo) return false;
        Text = history[position++].After; Changed?.Invoke(this, EventArgs.Empty); return true;
    }
    public DocumentDiagnostic? ExternalChange()
    {
        try { store.CheckUnchanged(FilePath, fingerprint); return null; }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or DocumentException)
        {
            return new DocumentDiagnostic(error is DocumentException d ? d.Code : "E_IO", FilePath, error.Message);
        }
    }
    public void PreflightSave()
    {
        _ = ManifestReader.Read(Text); store.CheckUnchanged(FilePath, fingerprint);
    }
    public bool Save()
    {
        if (!IsDirty) return false; // No formatting-only writes or backups from merely opening a file.
        PreflightSave();
        fingerprint = store.Write(FilePath, Encoding.UTF8.GetBytes(Text), fingerprint);
        savedText = Text; Changed?.Invoke(this, EventArgs.Empty); return true;
    }
    public void Reload(bool discardChanges = false)
    {
        if (IsDirty && !discardChanges) throw new DocumentException("E_DIRTY", FilePath, "Apply a save/discard decision before reloading.");
        var loaded = Load(); // Validate before replacing current work or history.
        Text = savedText = loaded.Text; fingerprint = loaded.Fingerprint;
        history.Clear(); position = 0; Changed?.Invoke(this, EventArgs.Empty);
    }
    public void SaveCopy(string target) => Export(target, clone: false);
    public void CloneAsNewGame(string target) => Export(target, clone: true);
    private void Export(string target, bool clone)
    {
        target = AtomicFileStore.Normalize(target);
        if (AtomicFileStore.PathComparer.Equals(target, FilePath)) throw new DocumentException("E_TARGET_EXISTS", target, "Choose a different filename.");
        if (!target.EndsWith(".maxxia", StringComparison.OrdinalIgnoreCase)) throw new DocumentException("E_EXTENSION", target, "Use the .maxxia extension.");
        if (clone && !AtomicFileStore.PathComparer.Equals(Path.GetDirectoryName(target)!, Path.GetDirectoryName(FilePath)!))
            throw new DocumentException("E_LOCATION", target, "Create the clone beside this manifest so its relative maps and assets stay available.");
        var text = Text;
        if (clone)
        {
            var json = JsonNode.Parse(text)!.AsObject();
            json["projectId"] = ManifestReader.CreateStableId("project");
            text = ManifestReader.Serialize(ManifestReader.Read(json.ToJsonString()));
        }
        _ = store.Write(target, Encoding.UTF8.GetBytes(text), expectedFingerprint: null);
    }
}

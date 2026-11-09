using System.Text;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker.Documents;

/// <summary>Safe class definition edit history; never modifies a game save.</summary>
public sealed class ClassDatabaseDocument
{
    private readonly IDocumentStore store;
    private readonly List<string> history = [];
    private int index;
    private string saved;
    private string fingerprint;
    public string FilePath { get; }
    public string Text => history[index];
    public bool IsDirty => Text != saved;
    public bool CanUndo => index > 0;
    public bool CanRedo => index < history.Count - 1;
    public JsonObject Model => ClassDatabaseReader.Read(Text);
    public ClassDatabaseDocument(string path, IDocumentStore? store = null)
    {
        FilePath = Path.GetFullPath(path);
        this.store = store ?? new AtomicFileStore(maxBytes: ClassDatabaseReader.MaxBytes);
        var snapshot = this.store.Read(FilePath);
        saved = Canonical(new UTF8Encoding(false, true).GetString(snapshot.Bytes));
        history.Add(saved); fingerprint = snapshot.Fingerprint;
    }
    private static string Canonical(string input) => ClassDatabaseReader.Read(input).ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }) + "\n";
    public bool Apply(string draft)
    {
        var text = Canonical(draft);
        if (Text == text) return false;
        if (index < history.Count - 1) history.RemoveRange(index + 1, history.Count - index - 1);
        history.Add(text); index++;
        if (history.Count > 100) { history.RemoveAt(0); index--; }
        return true;
    }
    public void Undo() { if (CanUndo) index--; }
    public void Redo() { if (CanRedo) index++; }
    public void Save()
    {
        if (!IsDirty) return;
        _ = ClassDatabaseReader.Read(Text);
        fingerprint = store.Write(FilePath, Encoding.UTF8.GetBytes(Text), fingerprint);
        saved = Text;
    }
    public bool HasExternalChange { get { try { store.CheckUnchanged(FilePath, fingerprint); return false; } catch (DocumentException) { return true; } } }
}

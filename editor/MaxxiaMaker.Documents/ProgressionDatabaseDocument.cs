using System.Text;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker.Documents;
/// <summary>MM09 safe progression snapshots, bounded undo and atomic save.</summary>
public sealed class ProgressionDatabaseDocument
{
    private readonly IDocumentStore store;
    private readonly List<string> history = [];
    private int index;
    private string saved, fingerprint;
    public string FilePath { get; }
    public string Text => history[index];
    public JsonObject Model => ProgressionDatabaseReader.Read(Text);
    public bool IsDirty => Text != saved;
    public bool CanUndo => index > 0;
    public bool CanRedo => index < history.Count - 1;
    public ProgressionDatabaseDocument(string path, IDocumentStore? store = null)
    {
        FilePath = Path.GetFullPath(path);this.store = store ?? new AtomicFileStore(maxBytes: ProgressionDatabaseReader.MaxBytes);
        var snapshot = this.store.Read(FilePath); saved = Canonical(new UTF8Encoding(false, true).GetString(snapshot.Bytes));history.Add(saved);fingerprint = snapshot.Fingerprint;
    }
    private static string Canonical(string text) => ProgressionDatabaseReader.Read(text).ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }) + "\n";
    public bool Apply(string input)
    {
        var text = Canonical(input);if (text == Text) return false;
        if (index < history.Count - 1) history.RemoveRange(index + 1, history.Count - index - 1);
        history.Add(text);index++;if (history.Count > 100) { history.RemoveAt(0);index--; }return true;
    }
    public void Undo() { if (CanUndo) index--; }
    public void Redo() { if (CanRedo) index++; }
    public void Save()
    {
        if (!IsDirty) return;_ = ProgressionDatabaseReader.Read(Text);
        fingerprint = store.Write(FilePath, Encoding.UTF8.GetBytes(Text), fingerprint);saved = Text;
    }
    public bool HasExternalChange { get { try { store.CheckUnchanged(FilePath, fingerprint);return false; } catch (DocumentException) { return true; } } }
}

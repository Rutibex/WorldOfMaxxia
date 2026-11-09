using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker.Documents;

/// <summary>MM08 bounded undo/redo and atomic, conflict-checked actor document saves.</summary>
public sealed class ActorDatabaseDocument
{
    private readonly IDocumentStore store;
    private readonly List<string> history = [];
    private int position;
    private string saved;
    private string fingerprint;
    public string FilePath { get; }
    public string Text => history[position];
    public JsonObject Model => ActorDatabaseReader.Read(Text);
    public bool IsDirty => Text != saved;
    public bool CanUndo => position > 0;
    public bool CanRedo => position < history.Count - 1;
    private static string Canonical(string text) => ActorDatabaseReader.Read(text).ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n";
    public ActorDatabaseDocument(string path, IDocumentStore? store = null)
    {
        FilePath = Path.GetFullPath(path);this.store = store ?? new AtomicFileStore(maxBytes: ActorDatabaseReader.MaxBytes);
        var state = this.store.Read(FilePath);saved = Canonical(new UTF8Encoding(false, true).GetString(state.Bytes));fingerprint = state.Fingerprint;history.Add(saved);
    }
    public bool Apply(string text)
    {
        var value = Canonical(text);if (value == Text) return false;
        if (position < history.Count - 1) history.RemoveRange(position + 1, history.Count - position - 1);
        history.Add(value);position++;
        if (history.Count > 100) { history.RemoveAt(0);position--; }
        return true;
    }
    public void Undo() { if (CanUndo) position--; }
    public void Redo() { if (CanRedo) position++; }
    public void Save()
    {
        if (!IsDirty) return;
        fingerprint = store.Write(FilePath, Encoding.UTF8.GetBytes(Text), fingerprint);saved = Text;
    }
    public bool HasExternalChange { get { try { store.CheckUnchanged(FilePath, fingerprint);return false; } catch (DocumentException) { return true; } } }
}

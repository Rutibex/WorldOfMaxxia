using System.Text;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker.Documents;

/// <summary>Safe independent JSON document with undo/redo and external-write detection.</summary>
public sealed class ItemDatabaseDocument
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
    public JsonObject Model => ItemDatabaseReader.Read(Text);
    public ItemDatabaseDocument(string path, IDocumentStore? store = null)
    {
        FilePath = Path.GetFullPath(path);
        this.store = store ?? new AtomicFileStore(maxBytes: ItemDatabaseReader.MaxBytes);
        var snapshot = this.store.Read(FilePath);
        saved = Canonical(new UTF8Encoding(false, true).GetString(snapshot.Bytes));
        history.Add(saved); fingerprint = snapshot.Fingerprint;
    }
    private static string Canonical(string input) => ItemDatabaseReader.Read(input).ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }) + "\n";
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
        _ = ItemDatabaseReader.Read(Text);
        fingerprint = store.Write(FilePath, Encoding.UTF8.GetBytes(Text), fingerprint);
        saved = Text;
    }
    public bool HasExternalChange { get { try { store.CheckUnchanged(FilePath, fingerprint); return false; } catch (DocumentException) { return true; } } }
}

namespace MaxxiaMaker.Documents;

public sealed record SaveAllResult(IReadOnlyList<string> Saved, DocumentDiagnostic? Failure, IReadOnlyList<string> Pending);
public sealed class DocumentWorkspace(IDocumentStore? fileStore = null)
{
    private readonly IDocumentStore store = fileStore ?? new AtomicFileStore();
    private readonly List<ProjectDocument> documents = [];
    public IReadOnlyList<ProjectDocument> Documents => documents.AsReadOnly();
    public ProjectDocument Open(string path)
    {
        path = AtomicFileStore.Normalize(path);
        var existing = documents.FirstOrDefault(d => AtomicFileStore.PathComparer.Equals(d.FilePath, path));
        if (existing is not null) return existing;
        var document = new ProjectDocument(path, store); documents.Add(document); return document;
    }
    public void Close(ProjectDocument document, bool discardChanges = false)
    {
        if (document.IsDirty && !discardChanges) throw new DocumentException("E_DIRTY", document.FilePath, "Save or explicitly discard changes before closing.");
        documents.Remove(document);
    }
    public SaveAllResult SaveAll()
    {
        var pending = documents.Where(d => d.IsDirty).ToArray(); var saved = new List<string>();
        try { foreach (var doc in pending) doc.PreflightSave(); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or DocumentException)
        {
            return new SaveAllResult(saved, Diagnostic(error), pending.Select(d => d.FilePath).ToArray());
        }
        foreach (var doc in pending)
        {
            try { doc.Save(); saved.Add(doc.FilePath); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException or DocumentException)
            {
                return new SaveAllResult(saved, Diagnostic(error), documents.Where(d => d.IsDirty).Select(d => d.FilePath).ToArray());
            }
        }
        return new SaveAllResult(saved, null, []);
    }
    private static DocumentDiagnostic Diagnostic(Exception error) => new(error is DocumentException d ? d.Code : "E_IO", error is DocumentException file ? file.FilePath : "", error.Message);
}

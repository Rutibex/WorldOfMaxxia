using System.Text;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker.Documents;

/// <summary>MM12 atomic, externally checked condition-file edits with undo history.</summary>
public sealed class ConditionDatabaseDocument
{
    private readonly IDocumentStore store;
    private readonly List<string> history=[];
    private int index;private string saved,fingerprint;
    public string FilePath{get;}
    public string Text=>history[index];
    public JsonObject Model=>ConditionDatabaseReader.Read(Text);
    public bool IsDirty=>Text!=saved;
    public ConditionDatabaseDocument(string path,IDocumentStore? store=null)
    {
        FilePath=Path.GetFullPath(path);this.store=store??new AtomicFileStore(maxBytes:ConditionDatabaseReader.MaxBytes);
        var source=this.store.Read(FilePath);saved=Canonical(new UTF8Encoding(false,true).GetString(source.Bytes));history.Add(saved);fingerprint=source.Fingerprint;
    }
    private static string Canonical(string input)=>ConditionDatabaseReader.Read(input).ToJsonString(new System.Text.Json.JsonSerializerOptions{WriteIndented=true})+"\n";
    public bool Apply(string json)
    {
        var next=Canonical(json);if(next==Text)return false;
        if(index<history.Count-1)history.RemoveRange(index+1,history.Count-index-1);
        history.Add(next);index++;if(history.Count>100){history.RemoveAt(0);index--;}
        return true;
    }
    public void Undo(){if(index>0)index--;}
    public void Redo(){if(index<history.Count-1)index++;}
    public void Save(){if(!IsDirty)return;fingerprint=store.Write(FilePath,Encoding.UTF8.GetBytes(Text),fingerprint);saved=Text;}
    public bool HasExternalChange{get{try{store.CheckUnchanged(FilePath,fingerprint);return false;}catch(DocumentException){return true;}}}
}

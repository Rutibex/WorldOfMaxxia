using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker.Documents;

/// <summary>MM13 monster edit history, guarded atomic writes and external conflict detection.</summary>
public sealed class MonsterDatabaseDocument
{
    private readonly IDocumentStore store;
    private readonly List<string> history=[];
    private int index;private string saved,fingerprint;
    public string FilePath{get;}
    public string Text=>history[index];
    public JsonObject Model=>MonsterDatabaseReader.Read(Text);
    public bool IsDirty=>Text!=saved;
    public bool HasExternalChange{get{try{store.CheckUnchanged(FilePath,fingerprint);return false;}catch(DocumentException){return true;}}}
    public MonsterDatabaseDocument(string path,IDocumentStore? store=null)
    {
        FilePath=Path.GetFullPath(path);this.store=store??new AtomicFileStore(maxBytes:MonsterDatabaseReader.MaxBytes);
        var source=this.store.Read(FilePath);saved=Canonical(new UTF8Encoding(false,true).GetString(source.Bytes));history.Add(saved);fingerprint=source.Fingerprint;
    }
    private static string Canonical(string input)=>MonsterDatabaseReader.Read(input).ToJsonString(new JsonSerializerOptions{WriteIndented=true})+"\n";
    public bool Apply(string json)
    {
        var next=Canonical(json);if(next==Text)return false;
        if(index<history.Count-1)history.RemoveRange(index+1,history.Count-index-1);
        history.Add(next);index++;if(history.Count>100){history.RemoveAt(0);index--;}return true;
    }
    public void Undo(){if(index>0)index--;}
    public void Redo(){if(index<history.Count-1)index++;}
    public void Save(){if(!IsDirty)return;fingerprint=store.Write(FilePath,Encoding.UTF8.GetBytes(Text),fingerprint);saved=Text;}
}

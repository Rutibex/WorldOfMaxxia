using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker.Documents;
/// <summary>MM14: independent bounded snapshot history and guarded writes for each encounter file.</summary>
public sealed class EncounterDatabaseDocument
{
    private readonly IDocumentStore store;
    private readonly Func<string,JsonObject> reader;
    private readonly List<string> history=[];
    private int index;private string saved,fingerprint;
    public string FilePath{get;}
    public string Text=>history[index];
    public bool IsDirty=>Text!=saved;
    public JsonObject Model=>reader(Text);
    public bool HasExternalChange{get{try{store.CheckUnchanged(FilePath,fingerprint);return false;}catch(DocumentException){return true;}}}
    public EncounterDatabaseDocument(string path,Func<string,JsonObject> validator)
    {
        FilePath=Path.GetFullPath(path);reader=validator;store=new AtomicFileStore(maxBytes:EncounterDatabaseReader.MaxBytes);
        var source=store.Read(FilePath);saved=Canonical(new UTF8Encoding(false,true).GetString(source.Bytes));fingerprint=source.Fingerprint;history.Add(saved);
    }
    private string Canonical(string input)=>reader(input).ToJsonString(new JsonSerializerOptions{WriteIndented=true})+"\n";
    public bool Apply(string text)
    {
        var next=Canonical(text);if(next==Text)return false;
        if(index<history.Count-1)history.RemoveRange(index+1,history.Count-index-1);
        history.Add(next);index++;if(history.Count>100){history.RemoveAt(0);index--;}return true;
    }
    public void Undo(){if(index>0)index--;}
    public void Redo(){if(index<history.Count-1)index++;}
    public void Save(){if(!IsDirty)return;fingerprint=store.Write(FilePath,Encoding.UTF8.GetBytes(Text),fingerprint);saved=Text;}
}

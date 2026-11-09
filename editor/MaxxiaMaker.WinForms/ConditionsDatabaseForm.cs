using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker;

/// <summary>MM12 native editor for the six supported condition definitions.</summary>
public sealed class ConditionsDatabaseForm : Form
{
    private readonly ConditionDatabaseDocument document;
    private readonly ListBox list=new(){Dock=DockStyle.Left,Width=250};
    private readonly TextBox id=new(){ReadOnly=true,Dock=DockStyle.Top},name=new(){MaxLength=80,Dock=DockStyle.Top},description=new(){MaxLength=500,Multiline=true,Height=110,Dock=DockStyle.Top};
    private readonly ComboBox repeat=new(){Dock=DockStyle.Top,DropDownStyle=ComboBoxStyle.DropDownList};
    private readonly Label status=new(){AutoSize=true};
    private bool filling,draft;private string? selectedId;
    public ConditionsDatabaseForm(string manifestPath,ProjectManifest project)
    {
        var relative=project.Content.Spells??throw new ManifestException("E_CONDITION","$.content.spells","Project has no spell database.");
        var folder=Path.GetDirectoryName(Path.GetFullPath(manifestPath))!;
        var spellsPath=Path.GetFullPath(Path.Combine(folder,relative.Replace('/',Path.DirectorySeparatorChar)));
        if(!spellsPath.StartsWith(folder+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new ManifestException("E_CONDITION_PATH","$","Unsafe spells path.");
        var spellData=SpellDatabaseReader.Read(File.ReadAllText(spellsPath));
        var filename=spellData["conditionsFile"]?.ToString()??throw new ManifestException("E_CONDITION_FILE","$.conditionsFile","Add a conditionsFile property to the spells database.");
        var path=Path.Combine(Path.GetDirectoryName(spellsPath)!,filename);
        document=new ConditionDatabaseDocument(path);
        Text="Maxxia Maker — Conditions database";ClientSize=new Size(790,480);MinimumSize=new Size(590,380);StartPosition=FormStartPosition.CenterParent;AutoScaleMode=AutoScaleMode.Dpi;
        repeat.Items.AddRange(["replace","extend"]);
        var content=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(15),ColumnCount=1,AutoScroll=true};
        void Field(string label,Control control){content.Controls.Add(new Label{Text=label,AutoSize=true});content.Controls.Add(control);}
        Field("Permanent condition ID (cannot change)",id);Field("Display name",name);Field("Description",description);Field("Reapply existing condition",repeat);
        content.Controls.Add(new Label{AutoSize=true,MaximumSize=new Size(440,0),Text="Condition mechanics and stable IDs remain fixed for existing save compatibility. Extend adds durations of the same unit, capped at 999; replace refreshes duration."});
        var bottom=new FlowLayoutPanel{Dock=DockStyle.Bottom,AutoSize=true,Padding=new Padding(10)};
        void MakeButton(string label,System.Action handler){var button=new Button{Text=label,AutoSize=true};button.Click+=(_,_)=>Safe(handler);bottom.Controls.Add(button);}
        MakeButton("Apply",Apply);MakeButton("Undo",()=>{if(Resolve()){document.Undo();Refresh();}});MakeButton("Redo",()=>{if(Resolve()){document.Redo();Refresh();}});MakeButton("Save",Save);MakeButton("Close",Close);bottom.Controls.Add(status);
        Controls.Add(content);Controls.Add(list);Controls.Add(bottom);
        list.SelectedIndexChanged+=(_,_)=>{
            if(filling)return;
            if(!Resolve())
            {
                filling=true;list.SelectedItem=selectedId;filling=false;return;
            }
            Load();
        };
        name.TextChanged+=(_,_)=>Dirty();description.TextChanged+=(_,_)=>Dirty();repeat.SelectedIndexChanged+=(_,_)=>Dirty();
        FormClosing+=OnClosing;Refresh();
    }
    private void Safe(Action action){try{action();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Conditions database",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
    private void Dirty(){if(!filling){draft=true;UpdateStatus();}}
    private void UpdateStatus()=>status.Text=document.HasExternalChange?"External change!":draft?"Unapplied edits":document.IsDirty?"Save required":"Saved";
    private JsonArray Records=>document.Model["conditions"]!.AsArray();
    private void Refresh()
    {
        filling=true;list.Items.Clear();foreach(var node in Records)list.Items.Add(node!["id"]!.GetValue<string>());
        list.SelectedIndex=list.Items.Count>0?0:-1;filling=false;Load();
    }
    private void Load()
    {
        if(list.SelectedItem is not string key)return;
        var row=Records.First(x=>x!["id"]!.GetValue<string>()==key)!.AsObject();
        filling=true;selectedId=key;id.Text=key;name.Text=row["name"]!.GetValue<string>();description.Text=row["description"]!.GetValue<string>();repeat.SelectedItem=row["reapply"]!.GetValue<string>();filling=false;draft=false;UpdateStatus();
    }
    private bool Resolve()
    {
        if(!draft)return true;
        var result=MessageBox.Show(this,"Apply changes to the selected condition?","Unapplied edits",MessageBoxButtons.YesNoCancel);
        if(result==DialogResult.Cancel)return false;if(result==DialogResult.Yes){Apply();return !draft;}draft=false;return true;
    }
    private void Apply()
    {
        if(selectedId is not string key)return;
        var root=document.Model;var row=root["conditions"]!.AsArray().First(x=>x!["id"]!.GetValue<string>()==key)!.AsObject();
        row["name"]=name.Text;row["description"]=description.Text;row["reapply"]=repeat.SelectedItem?.ToString()??"replace";
        document.Apply(root.ToJsonString());draft=false;UpdateStatus();
    }
    private void Save(){if(!Resolve())return;document.Save();UpdateStatus();}
    private void OnClosing(object? sender,FormClosingEventArgs e)
    {
        if(!Resolve()){e.Cancel=true;return;}if(!document.IsDirty)return;
        var answer=MessageBox.Show(this,"Save condition changes?","Unsaved conditions",MessageBoxButtons.YesNoCancel);
        if(answer==DialogResult.Cancel){e.Cancel=true;return;}
        if(answer==DialogResult.Yes)try{Save();}catch(Exception error){MessageBox.Show(this,error.Message);e.Cancel=true;}
    }
    protected override bool ProcessCmdKey(ref Message msg,Keys key)
    {if(key==(Keys.Control|Keys.S)){Safe(Save);return true;}return base.ProcessCmdKey(ref msg,key);}
}

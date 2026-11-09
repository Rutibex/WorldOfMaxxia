using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;

namespace MaxxiaMaker;

/// <summary>Focused MM18 native controls; edits are accepted only through MapWorkspace.</summary>
internal sealed class ArrivalEditorDialog : Form
{
    public string ArrivalName => name.Text.Trim();
    public int TileX => (int)x.Value;
    public int TileY => (int)y.Value;
    public int Facing => facing.SelectedIndex;
    public string Operation {get;private set;}="cancel";
    private readonly TextBox name=new(){Width=290,MaxLength=100};
    private readonly NumericUpDown x=new(){Width=90};
    private readonly NumericUpDown y=new(){Width=90};
    private readonly ComboBox facing=new(){Width=180,DropDownStyle=ComboBoxStyle.DropDownList};
    public ArrivalEditorDialog(JsonObject map,int tileX,int tileY,JsonObject? existing)
    {
        Text=existing is null?"Place named arrival":"Edit named arrival";
        ClientSize=new Size(435,248);FormBorderStyle=FormBorderStyle.FixedDialog;StartPosition=FormStartPosition.CenterParent;
        MaximizeBox=false;MinimizeBox=false;
        x.Maximum=MapDocument.Number(map,"width")-2;y.Maximum=MapDocument.Number(map,"height")-2;
        x.Minimum=1;y.Minimum=1;
        x.Value=existing is null?Math.Clamp(tileX,1,(int)x.Maximum):MapDocument.Number(existing,"x");
        y.Value=existing is null?Math.Clamp(tileY,1,(int)y.Maximum):MapDocument.Number(existing,"y");
        name.Text=existing is null?"New Entrance":existing["name"]?.ToString()??"Arrival";
        facing.Items.AddRange(["North ↑","East →","South ↓","West ←"]);
        facing.SelectedIndex=existing is null?0:MapDocument.Number(existing,"facing");
        AddLabel("Arrival name",16,12);name.SetBounds(16,32,400,27);Controls.Add(name);
        AddLabel("X",16,70);x.SetBounds(16,90,94,27);Controls.Add(x);
        AddLabel("Y",124,70);y.SetBounds(124,90,94,27);Controls.Add(y);
        AddLabel("Facing",234,70);facing.SetBounds(234,90,180,27);Controls.Add(facing);
        AddLabel("Move by changing X/Y. Transfers targeting this arrival follow its ID.",16,134);
        AddButton("Save",16,185,"save");
        if(existing is not null&&existing["id"]?.ToString()!="arrival_start")AddButton("Delete",126,185,"delete");
        AddButton("Cancel",326,185,"cancel");
    }
    private void AddLabel(string value,int left,int top)=>Controls.Add(new Label{Text=value,Left=left,Top=top,AutoSize=true});
    private void AddButton(string value,int left,int top,string operation)
    {var button=new Button{Text=value,Left=left,Top=top,Width=94,Height=32};button.Click+=(_,_)=>{Operation=operation;DialogResult=operation=="cancel"?DialogResult.Cancel:DialogResult.OK;Close();};Controls.Add(button);}
}

internal sealed class TransferEditorDialog : Form
{
    private sealed record MapOption(string Id,string Name){public override string ToString()=>Name+" ("+Id+")";}
    private sealed record ArrivalOption(string Id,string Name,int X,int Y,int Facing)
    {public override string ToString()=>Name+" ("+Id+")";}
    public int TileX => (int)x.Value;
    public int TileY => (int)y.Value;
    public string TargetMapId => ((MapOption)maps.SelectedItem!).Id;
    public string? TargetArrivalId => ((ArrivalOption)arrivals.SelectedItem!).Id is {Length: > 0} id?id:null;
    public string Activation => activation.SelectedIndex==1?"step":"interact";
    public string Operation {get;private set;}="cancel";
    private readonly MapWorkspace workspace;
    private readonly NumericUpDown x=new(){Width=94};
    private readonly NumericUpDown y=new(){Width=94};
    private readonly ComboBox maps=new(){DropDownStyle=ComboBoxStyle.DropDownList};
    private readonly ComboBox arrivals=new(){DropDownStyle=ComboBoxStyle.DropDownList};
    private readonly ComboBox activation=new(){DropDownStyle=ComboBoxStyle.DropDownList};
    private readonly Label preview=new(){AutoSize=true};
    public TransferEditorDialog(MapWorkspace workspace,string sourceId,int tileX,int tileY,JsonObject? existing)
    {
        this.workspace=workspace;
        Text=existing is null?"Place map transfer":"Edit map transfer";
        ClientSize=new Size(520,346);FormBorderStyle=FormBorderStyle.FixedDialog;StartPosition=FormStartPosition.CenterParent;
        MaximizeBox=false;MinimizeBox=false;
        var source=workspace.Get(sourceId).Model;
        x.Minimum=1;y.Minimum=1;x.Maximum=MapDocument.Number(source,"width")-2;y.Maximum=MapDocument.Number(source,"height")-2;
        x.Value=existing is null?Math.Clamp(tileX,1,(int)x.Maximum):MapDocument.Number(existing,"x");
        y.Value=existing is null?Math.Clamp(tileY,1,(int)y.Maximum):MapDocument.Number(existing,"y");
        AddLabel("Source X",16,12);x.SetBounds(16,32,94,27);Controls.Add(x);
        AddLabel("Source Y",126,12);y.SetBounds(126,32,94,27);Controls.Add(y);
        AddLabel("Destination map",16,73);maps.SetBounds(16,94,480,28);Controls.Add(maps);
        AddLabel("Named arrival",16,136);arrivals.SetBounds(16,156,480,28);Controls.Add(arrivals);
        AddLabel("Activation",16,197);activation.SetBounds(16,217,170,28);Controls.Add(activation);
        activation.Items.AddRange(["Interact (Space)","Step onto square"]);activation.SelectedIndex=existing is not null && existing["activation"]?.ToString()=="step"?1:0;
        preview.SetBounds(206,223,290,25);Controls.Add(preview);
        foreach(var (id,doc) in workspace.Maps)maps.Items.Add(new MapOption(id,doc.Model["name"]?.ToString()??id));
        maps.SelectedIndexChanged+=(_,_)=>ReloadArrivals(existing);
        arrivals.SelectedIndexChanged+=(_,_)=>UpdatePreview();
        var selectedMapId=existing is null?null:existing["targetMapId"]?.ToString();
        var mapIndex=Enumerable.Range(0,maps.Items.Count).FirstOrDefault(i=>((MapOption)maps.Items[i]!).Id==selectedMapId);
        maps.SelectedIndex=mapIndex;
        AddButton("Save",16,286,"save");
        if(existing is not null){AddButton("Delete",124,286,"delete");AddButton("Make Return",232,286,"return");}
        AddButton("Cancel",406,286,"cancel");
    }
    private void ReloadArrivals(JsonObject? existing)
    {
        arrivals.Items.Clear();
        if(maps.SelectedItem is not MapOption selected)return;
        var target=workspace.Get(selected.Id).Model;
        if(existing is not null && existing["targetMapId"]?.ToString()==selected.Id && existing["targetArrivalId"] is null)
            arrivals.Items.Add(new ArrivalOption("","Original coordinate (legacy)",MapDocument.Number(existing,"targetX"),MapDocument.Number(existing,"targetY"),MapDocument.Number(existing,"targetFacing")));
        foreach(var node in target["arrivals"]!.AsArray())
        {
            var a=node!.AsObject();arrivals.Items.Add(new ArrivalOption(a["id"]!.ToString(),a["name"]!.ToString(),MapDocument.Number(a,"x"),MapDocument.Number(a,"y"),MapDocument.Number(a,"facing")));
        }
        var preferred=existing is null?null:existing["targetArrivalId"]?.ToString();
        var i=Enumerable.Range(0,arrivals.Items.Count).FirstOrDefault(n=>((ArrivalOption)arrivals.Items[n]!).Id==preferred);
        // Legacy coordinate-only portals select a matching named arrival, if available.
        if(preferred is null && existing is not null && existing["targetMapId"]?.ToString()==selected.Id)
            i=0; // Preserve the legacy coordinate link until the user explicitly selects an arrival ID.
        if(arrivals.Items.Count>0)arrivals.SelectedIndex=i;
        UpdatePreview();
    }
    private void UpdatePreview()
    {
        if(arrivals.SelectedItem is ArrivalOption a)
            preview.Text=$"Arrives at {a.X},{a.Y} facing {new[]{"North","East","South","West"}[a.Facing]}";
        else preview.Text="No arrival selected";
    }
    private void AddLabel(string value,int left,int top)=>Controls.Add(new Label{Text=value,Left=left,Top=top,AutoSize=true});
    private void AddButton(string value,int left,int top,string operation)
    {var button=new Button{Text=value,Left=left,Top=top,Width=operation=="return"?119:95,Height=32};button.Click+=(_,_)=>
        {if(operation=="save"&&(maps.SelectedItem is null||arrivals.SelectedItem is null)){MessageBox.Show(this,"Choose a destination and named arrival.");return;}
         Operation=operation;DialogResult=operation=="cancel"?DialogResult.Cancel:DialogResult.OK;Close();};Controls.Add(button);}
}

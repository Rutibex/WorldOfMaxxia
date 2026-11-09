using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

/// <summary>MM19: edit reusable environment profiles and material-to-image bindings, never asset paths.</summary>
public sealed class EnvironmentProfilesForm : Form
{
    private readonly MapWorkspace workspace;
    private readonly JsonObject working;
    private readonly ComboBox profiles=new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=230};
    private readonly TextBox name=new(){Width=235,MaxLength=120},skyColor=new(){Width=100},fogColor=new(){Width=100};
    private readonly NumericUpDown fog=new(){DecimalPlaces=3,Increment=0.005m,Minimum=0,Maximum=0.5m,Width=95};
    private readonly ComboBox sky=new(){Width=265,DropDownStyle=ComboBoxStyle.DropDownList};
    private readonly ListView materials=new(){View=View.Details,FullRowSelect=true,MultiSelect=false,Dock=DockStyle.Fill};
    private bool loading;private string? selectedId;
    private readonly List<(string id,string label)> resources;
    public EnvironmentProfilesForm(MapWorkspace workspace)
    {
        this.workspace=workspace;working=workspace.Environments.DeepClone().AsObject();
        resources=new List<(string id,string label)>{("","None (built-in)")};
        if(workspace.ResourceCatalog is { } catalog)
            resources.AddRange(catalog.Resources.Where(r=>r.Kind=="image"&&r.Exists).Select(r=>(r.Id,$"{r.Name} ({r.Id})")));
        Text="MM19 — Environment profiles and materials";ClientSize=new Size(865,580);MinimumSize=new Size(780,540);StartPosition=FormStartPosition.CenterParent;
        var top=new FlowLayoutPanel{Dock=DockStyle.Top,Height=185,Padding=new Padding(8),WrapContents=true,AutoScroll=true};
        top.Controls.Add(new Label{Text="Profile",AutoSize=true,Margin=new Padding(4,8,4,0)});top.Controls.Add(profiles);
        TopButton(top,"New",()=>AddProfile(false));TopButton(top,"Duplicate",()=>AddProfile(true));TopButton(top,"Delete",DeleteProfile);
        top.SetFlowBreak(top.Controls[^1],true);
        top.Controls.Add(new Label{Text="Name",AutoSize=true,Margin=new Padding(4,8,4,0)});top.Controls.Add(name);
        top.Controls.Add(new Label{Text="Sky #RGB",AutoSize=true,Margin=new Padding(10,8,4,0)});top.Controls.Add(skyColor);
        top.Controls.Add(new Label{Text="Fog #RGB",AutoSize=true,Margin=new Padding(10,8,4,0)});top.Controls.Add(fogColor);
        top.SetFlowBreak(top.Controls[^1],true);
        top.Controls.Add(new Label{Text="Fog strength",AutoSize=true,Margin=new Padding(4,8,4,0)});top.Controls.Add(fog);
        top.Controls.Add(new Label{Text="Sky image",AutoSize=true,Margin=new Padding(10,8,4,0)});top.Controls.Add(sky);
        foreach(var r in resources)sky.Items.Add(new ResourceChoice(r.id,r.label));
        materials.Columns.Add("Stable material ID",240);materials.Columns.Add("Surface",105);materials.Columns.Add("Name",160);materials.Columns.Add("Image resource",270);
        var actions=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=45,Padding=new Padding(6),WrapContents=false};
        TopButton(actions,"Add material",()=>EditMaterial(null));TopButton(actions,"Edit selected",()=>{if(materials.SelectedItems.Count>0)EditMaterial(materials.SelectedItems[0].Tag as string);});
        TopButton(actions,"Delete selected",DeleteMaterial);
        var bottom=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=48,FlowDirection=FlowDirection.RightToLeft,Padding=new Padding(9)};
        var cancel=new Button{Text="Cancel",DialogResult=DialogResult.Cancel,Width=90};var ok=new Button{Text="Apply profiles",Width=140};
        ok.Click+=(_,_)=>{try{SaveFields();workspace.SetEnvironmentDatabase(working);DialogResult=DialogResult.OK;Close();}catch(Exception e){MessageBox.Show(this,e.Message,"Invalid environment",MessageBoxButtons.OK,MessageBoxIcon.Warning);}};
        bottom.Controls.Add(cancel);bottom.Controls.Add(ok);
        Controls.Add(materials);Controls.Add(actions);Controls.Add(bottom);Controls.Add(top);CancelButton=cancel;
        profiles.SelectedIndexChanged+=(_,_)=>{if(loading)return;try{SaveFields();LoadProfile();}catch(Exception e){MessageBox.Show(this,e.Message,"Invalid profile");}};
        ReloadProfiles(working["profiles"]!.AsArray()[0]!["id"]!.ToString());
    }
    private static void TopButton(Control parent,string label,Action action){var button=new Button{Text=label,AutoSize=true,Margin=new Padding(6,4,3,3)};button.Click+=(_,_)=>action();parent.Controls.Add(button);}
    private sealed record ProfileChoice(string Id,string Label){public override string ToString()=>Label;}
    private sealed record ResourceChoice(string Id,string Label){public override string ToString()=>Label;}
    private void ReloadProfiles(string id)
    {
        loading=true;profiles.Items.Clear();foreach(var p in working["profiles"]!.AsArray())profiles.Items.Add(new ProfileChoice(p!["id"]!.ToString(),$"{p["name"]} ({p["id"]})"));
        profiles.SelectedIndex=Math.Max(0,profiles.Items.Cast<ProfileChoice>().ToList().FindIndex(p=>p.Id==id));loading=false;selectedId=id;LoadProfile();
    }
    private void SaveFields()
    {
        if(loading||selectedId is null)return;
        var p=EnvironmentProfiles.Profile(working,selectedId);
        p["name"]=name.Text.Trim();p["skyColor"]=skyColor.Text.Trim();p["fogColor"]=fogColor.Text.Trim();p["fogStrength"]=(double)fog.Value;
        p["skyResourceId"]=(sky.SelectedItem as ResourceChoice)?.Id is {Length:>0} id?id:null;
    }
    private void LoadProfile()
    {
        var next=(profiles.SelectedItem as ProfileChoice)?.Id;if(next is null)return;selectedId=next;loading=true;
        var p=EnvironmentProfiles.Profile(working,next);
        name.Text=p["name"]!.ToString();skyColor.Text=p["skyColor"]!.ToString();fogColor.Text=p["fogColor"]!.ToString();fog.Value=decimal.Parse(p["fogStrength"]!.ToString(),System.Globalization.CultureInfo.InvariantCulture);
        var target=p["skyResourceId"]?.ToString()??"";sky.SelectedIndex=Math.Max(0,sky.Items.Cast<ResourceChoice>().ToList().FindIndex(r=>r.Id==target));
        RenderMaterials();loading=false;
    }
    private void RenderMaterials()
    {
        materials.Items.Clear();if(selectedId is null)return;
        var p=EnvironmentProfiles.Profile(working,selectedId);
        foreach(var m in p["materials"]!.AsArray())
        {
            var row=new ListViewItem([m!["id"]!.ToString(),m["surface"]!.ToString(),m["name"]!.ToString(),m["resourceId"]?.ToString()??"Built-in texture"]){Tag=m["id"]!.ToString()};
            materials.Items.Add(row);
        }
    }
    private void AddProfile(bool duplicate)
    {
        SaveFields();var template=duplicate&&selectedId is not null?EnvironmentProfiles.Profile(working,selectedId):EnvironmentProfiles.Profile(EnvironmentProfiles.Default(),"environment_default");
        var created=template.DeepClone().AsObject();var id="environment_"+Guid.NewGuid().ToString("N");created["id"]=id;created["name"]=duplicate?created["name"]!.ToString()+" Copy":"New environment";
        working["profiles"]!.AsArray().Add(created);ReloadProfiles(id);
    }
    private void DeleteProfile()
    {
        if(selectedId is null)return;var profilesArray=working["profiles"]!.AsArray();if(profilesArray.Count==1){MessageBox.Show(this,"At least one environment must remain.");return;}
        if(workspace.Maps.Any(m=>m.document.Model["settings"]!["environmentId"]!.ToString()==selectedId)){MessageBox.Show(this,"This environment is assigned to a map. Reassign the map first.");return;}
        for(int i=profilesArray.Count-1;i>=0;i--)if(profilesArray[i]!["id"]!.ToString()==selectedId)profilesArray.RemoveAt(i);
        ReloadProfiles(profilesArray[0]!["id"]!.ToString());
    }
    private void EditMaterial(string? materialId)
    {
        if(selectedId is null)return;SaveFields();var profile=EnvironmentProfiles.Profile(working,selectedId);var mats=profile["materials"]!.AsArray();
        var original=materialId is null?null:mats.Select(m=>m!.AsObject()).FirstOrDefault(m=>m["id"]!.ToString()==materialId);
        using var dialog=new Form{Text=original is null?"New material":"Edit material",ClientSize=new Size(570,220),FormBorderStyle=FormBorderStyle.FixedDialog,StartPosition=FormStartPosition.CenterParent};
        var label=new TextBox{Left=20,Top=20,Width=530,Text=original is null ? "New material" : original["name"]?.ToString() ?? "",MaxLength=100};
        var surface=new ComboBox{Left=20,Top=60,Width=180,DropDownStyle=ComboBoxStyle.DropDownList};surface.Items.AddRange(["floor","wall","ceiling"]);surface.SelectedItem=original is null ? "wall" : original["surface"]?.ToString() ?? "wall";
        var image=new ComboBox{Left=20,Top=103,Width=530,DropDownStyle=ComboBoxStyle.DropDownList};foreach(var r in resources)image.Items.Add(new ResourceChoice(r.id,r.label));
        var current=original is null ? "" : original["resourceId"]?.ToString() ?? "";image.SelectedIndex=Math.Max(0,image.Items.Cast<ResourceChoice>().ToList().FindIndex(r=>r.Id==current));
        var ok=new Button{Text="OK",Left=350,Top=166,Width=85,DialogResult=DialogResult.OK};var cancel=new Button{Text="Cancel",Left=451,Top=166,Width=85,DialogResult=DialogResult.Cancel};
        dialog.Controls.AddRange([label,surface,image,ok,cancel]);dialog.AcceptButton=ok;dialog.CancelButton=cancel;
        if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        var updated=original?.DeepClone().AsObject()??new JsonObject{["id"]="material_"+Guid.NewGuid().ToString("N")};
        updated["name"]=label.Text.Trim();updated["surface"]=surface.SelectedItem!.ToString();updated["resourceId"]=(image.SelectedItem as ResourceChoice)?.Id is {Length:>0} res?res:null;
        if(original is null)mats.Add(updated);else{var index=mats.IndexOf(original);mats[index]=updated;}
        RenderMaterials();
    }
    private void DeleteMaterial()
    {
        if(materials.SelectedItems.Count==0||selectedId is null)return;
        var id=materials.SelectedItems[0].Tag as string;var array=EnvironmentProfiles.Profile(working,selectedId)["materials"]!.AsArray();
        for(int i=array.Count-1;i>=0;i--)if(array[i]!["id"]!.ToString()==id)array.RemoveAt(i);
        RenderMaterials();
    }
}

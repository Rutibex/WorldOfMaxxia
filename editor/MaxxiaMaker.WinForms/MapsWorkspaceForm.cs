using System.Diagnostics;
using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

public sealed class MapsWorkspaceForm : Form
{
    private readonly MapWorkspace workspace;
    private readonly TreeView tree=new(){Dock=DockStyle.Fill,HideSelection=false};
    private readonly MapCanvas canvas=new();
    private readonly ToolStripStatusLabel status=new();
    private readonly ToolStrip tools=new(){Dock=DockStyle.Top,GripStyle=ToolStripGripStyle.Hidden};
    private readonly ToolStripComboBox surface=new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=82};
    private readonly ToolStripComboBox materials=new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=185};
    private bool refreshing;
    private string? selected;
    public MapsWorkspaceForm(string projectPath,ProjectManifest manifest,string? initialId=null)
    {
        workspace=new MapWorkspace(projectPath,manifest);selected=initialId;
        Text="Maps — MM19";ClientSize=new Size(1150,760);MinimumSize=new Size(900,600);StartPosition=FormStartPosition.CenterParent;KeyPreview=true;
        var split=new SplitContainer{Dock=DockStyle.Fill,Size=ClientSize,SplitterDistance=245};split.Panel1.Controls.Add(tree);split.Panel2.Controls.Add(canvas);
        var bar=new StatusStrip();bar.Items.Add(status);Controls.Add(split);Controls.Add(tools);Controls.Add(bar);
        Button("Save All",Save);Button("Undo",()=>{workspace.Undo();RefreshMaps();});Button("Redo",()=>{workspace.Redo();RefreshMaps();});
        Button("New",()=>{var name=Ask("New map name","New Map");if(name is not null){selected=workspace.Add(name);RefreshMaps();}});
        Button("Duplicate",()=>{if(selected is null)return;var name=Ask("Duplicate map name",workspace.Get(selected).Model["name"]+" Copy");if(name is not null&&MessageBox.Show(this,"Duplicate local object IDs and self-links? Links to other maps will retain their original destinations.","Duplicate map",MessageBoxButtons.OKCancel)==DialogResult.OK){selected=workspace.Add(name,selected);RefreshMaps();}});
        Button("Rename",()=>{if(selected is null)return;var name=Ask("Map name",workspace.Get(selected).Model["name"]!.ToString());if(name is not null){workspace.Rename(selected,name);RefreshMaps();}});
        Button("Remove",()=>{if(selected is null)return;if(MessageBox.Show(this,"Remove this map from the index? The original map file remains on disk for recovery. References must be resolved first.","Remove map",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;workspace.Remove(selected);selected=null;RefreshMaps();});
        Button("Resize",ResizeMap);
        Button("Environment",ChooseEnvironment);
        Button("Profiles",()=>{using var dialog=new EnvironmentProfilesForm(workspace);if(dialog.ShowDialog(this)==DialogResult.OK)RefreshMaps();});
        Button("Preview",PreviewMap);
        var modes=new ToolStripComboBox{DropDownStyle=ComboBoxStyle.DropDownList,Width=100};modes.Items.AddRange(["Pencil","Erase","Rectangle","Fill","Select","Pan","Arrival","Transfer","Material"]);modes.SelectedIndex=0;modes.SelectedIndexChanged+=(_,_)=>canvas.Tool=modes.Text;tools.Items.Add(modes);
        var brush=new ToolStripComboBox{DropDownStyle=ComboBoxStyle.DropDownList,Width=85};brush.Items.AddRange(["Floor .","Wall #"]);brush.SelectedIndex=0;brush.SelectedIndexChanged+=(_,_)=>canvas.Brush=brush.SelectedIndex==0?'.':'#';tools.Items.Add(brush);
        surface.Items.AddRange(["floor","wall","ceiling"]);surface.SelectedItem="wall";
        surface.SelectedIndexChanged+=(_,_)=>{canvas.MaterialSurface=surface.Text;RefreshMaterialChoices();};tools.Items.Add(surface);
        materials.SelectedIndexChanged+=(_,_)=>{if(materials.SelectedItem is MaterialChoice m)canvas.MaterialBrush=m.Id;};tools.Items.Add(materials);
        Button("Set Default",()=>{if(selected is null||materials.SelectedItem is not MaterialChoice m)return;workspace.SetDefaultMaterial(selected,surface.Text,m.Id);RefreshMaps();});
        Button("Copy",canvas.Copy);Button("Paste",()=>{canvas.Paste();});Button("−",()=>canvas.Zoom(-4));Button("+",()=>canvas.Zoom(4));
        canvas.Changed+=()=>{workspace.Commit();RefreshMaps();};canvas.Status+=text=>status.Text=text;
        canvas.MarkerClicked+=(tool,x,y)=>Guard(()=>{if(selected is null)return;if(tool=="Arrival")EditArrival(selected,x,y);else EditTransfer(selected,x,y);});
        tree.AfterSelect+=(_,e)=>{if(refreshing)return;selected=e.Node?.Tag as string;canvas.Document=selected is null?null:workspace.Get(selected);canvas.ResetView();};
        KeyDown+=(_,e)=>{if(e.Control&&e.KeyCode==Keys.S){Guard(Save);e.SuppressKeyPress=true;}else if(e.Control&&e.KeyCode==Keys.Z){workspace.Undo();RefreshMaps();e.SuppressKeyPress=true;}else if(e.Control&&e.KeyCode==Keys.Y){workspace.Redo();RefreshMaps();e.SuppressKeyPress=true;}else if(e.Control&&e.KeyCode==Keys.C){canvas.Copy();e.SuppressKeyPress=true;}else if(e.Control&&e.KeyCode==Keys.V){Guard(canvas.Paste);e.SuppressKeyPress=true;}};
        FormClosing+=(_,e)=>{if(!workspace.IsDirty)return;var answer=MessageBox.Show(this,"Save all map changes before closing?","Unsaved maps",MessageBoxButtons.YesNoCancel);if(answer==DialogResult.Cancel)e.Cancel=true;else if(answer==DialogResult.Yes){try{Save();}catch(Exception error){MessageBox.Show(this,error.Message,"Save failed");e.Cancel=true;}}};
        RefreshMaps();
    }
    private void Guard(Action action){try{action();}catch(Exception error){MessageBox.Show(this,error.Message,"Map operation could not complete",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
    private void Button(string text,Action action){var button=new ToolStripButton(text);button.Click+=(_,_)=>Guard(action);tools.Items.Add(button);}
    private void RefreshMaps()
    {
        refreshing=true;tree.BeginUpdate();tree.Nodes.Clear();
        foreach(var (id,document) in workspace.Maps){var map=document.Model;var node=new TreeNode($"{map["name"]}{(document.IsDirty?" *":"")}  {map["width"]}×{map["height"]}"){Tag=id,ToolTipText=id};tree.Nodes.Add(node);if(id==selected)tree.SelectedNode=node;}
        if(tree.SelectedNode is null&&tree.Nodes.Count>0){tree.SelectedNode=tree.Nodes[0];selected=tree.SelectedNode.Tag as string;}
        canvas.Document=selected is null?null:workspace.Get(selected);RefreshMaterialChoices();canvas.Invalidate();tree.EndUpdate();refreshing=false;
        Text="Maps — MM19"+(workspace.IsDirty?" *":"");status.Text="Floor: beige · Wall: gray · Door: brown · A: arrival · T: transfer · Gold square: material override · Material tool paints selected surface";
    }
    private sealed record MaterialChoice(string Id,string Name){public override string ToString()=>Name;}
    private void RefreshMaterialChoices()
    {
        var previous=(materials.SelectedItem as MaterialChoice)?.Id;
        materials.Items.Clear();if(selected is null||!workspace.Maps.Any(m=>m.id==selected))return;
        var map=workspace.Get(selected).Model;var profileId=map["settings"]!["environmentId"]!.ToString();
        var profile=EnvironmentProfiles.Profile(workspace.Environments,profileId);var layer=surface.Text.Length>0?surface.Text:"wall";
        foreach(var item in profile["materials"]!.AsArray().Where(m=>m!["surface"]!.ToString()==layer))
            materials.Items.Add(new MaterialChoice(item!["id"]!.ToString(),item["name"]!.ToString()));
        if(materials.Items.Count>0)
        {
            var defaultId=map["materials"]![layer]!["default"]!.ToString();
            var choices=materials.Items.Cast<MaterialChoice>().ToList();
            var index=choices.FindIndex(x=>x.Id==previous);
            if(index<0)index=choices.FindIndex(x=>x.Id==defaultId);
            materials.SelectedIndex=Math.Max(0,index);
        }
    }
    private void ChooseEnvironment()
    {
        if(selected is null)return;
        using var form=new Form{Text="Choose map environment",ClientSize=new Size(475,130),FormBorderStyle=FormBorderStyle.FixedDialog,StartPosition=FormStartPosition.CenterParent};
        var list=new ComboBox{Left=12,Top=15,Width=448,DropDownStyle=ComboBoxStyle.DropDownList};
        foreach(var profile in workspace.Environments["profiles"]!.AsArray())list.Items.Add(new MaterialChoice(profile!["id"]!.ToString(),profile["name"]!.ToString()));
        var current=workspace.Get(selected).Model["settings"]!["environmentId"]!.ToString();
        list.SelectedIndex=Math.Max(0,list.Items.Cast<MaterialChoice>().ToList().FindIndex(p=>p.Id==current));
        var ok=new Button{Text="Apply",Left=272,Top=77,Width=90,DialogResult=DialogResult.OK};var cancel=new Button{Text="Cancel",Left=371,Top=77,Width=90,DialogResult=DialogResult.Cancel};
        form.Controls.AddRange([list,ok,cancel]);form.AcceptButton=ok;form.CancelButton=cancel;
        if(form.ShowDialog(this)!=DialogResult.OK||list.SelectedItem is not MaterialChoice picked)return;
        // Profile switch preserves geometry and refuses to discard incompatible painted overrides.
        workspace.SetMapEnvironment(selected,picked.Id);RefreshMaps();
    }
    private void PreviewMap()
    {
        // A preview bridge to the actual browser runtime, not a fake native renderer.
        // Integrated WebView2 snapshots and hot reload belong to MM37.
        var root=new DirectoryInfo(AppContext.BaseDirectory);
        while(root is not null&&!File.Exists(Path.Combine(root.FullName,"engine","world-of-maxxia","public","WorldOfMaxxia.maxxia")))root=root.Parent;
        if(root is null)throw new InvalidOperationException("The Maxxia browser source workspace is required for preview. Extract the full MM19 source archive.");
        var publicRoot=Path.GetFullPath(Path.Combine(root.FullName,"engine","world-of-maxxia","public"));
        var relative=Path.GetRelativePath(publicRoot,workspace.ProjectPath).Replace('\\','/');
        if(relative.StartsWith("../",StringComparison.Ordinal)||relative=="..")throw new InvalidOperationException("Preview project must be inside engine/world-of-maxxia/public.");
        var query=Uri.EscapeDataString(relative);
        MessageBox.Show(this,"Save All, start the local game server with npm run start:game, then use the browser to playtest this project. MM37 will provide integrated unsaved-snapshot preview.","Browser runtime preview",MessageBoxButtons.OK,MessageBoxIcon.Information);
        Process.Start(new ProcessStartInfo($"http://localhost:3000/?project={query}"){UseShellExecute=true});
    }
    private void EditArrival(string mapId,int x,int y)
    {
        var map=workspace.Get(mapId).Model;
        MapTransfers.AssertFloor(map,x,y);
        var existing=map["arrivals"]!.AsArray().Select(a=>a!.AsObject()).FirstOrDefault(a=>MapDocument.Number(a,"x")==x&&MapDocument.Number(a,"y")==y);
        using var dialog=new ArrivalEditorDialog(map,x,y,existing);
        if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        if(dialog.Operation=="delete")
        {
            if(existing is null)return;
            if(MessageBox.Show(this,"Delete this arrival? Transfers referencing it must be redirected first.","Delete arrival",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;
            workspace.RemoveArrival(mapId,existing["id"]!.ToString());
        }
        else workspace.PutArrival(mapId,existing?["id"]?.ToString(),dialog.ArrivalName,dialog.TileX,dialog.TileY,dialog.Facing);
        RefreshMaps();
    }
    private void EditTransfer(string mapId,int x,int y)
    {
        var map=workspace.Get(mapId).Model;
        MapTransfers.AssertFloor(map,x,y);
        var existing=map["objects"]!["portals"]!.AsArray().Select(p=>p!.AsObject()).FirstOrDefault(p=>MapDocument.Number(p,"x")==x&&MapDocument.Number(p,"y")==y);
        using var dialog=new TransferEditorDialog(workspace,mapId,x,y,existing);
        if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        if(dialog.Operation=="delete")
        {
            if(existing is null)return;
            if(MessageBox.Show(this,"Delete this transfer?","Delete transfer",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;
            workspace.RemovePortal(mapId,existing["id"]!.ToString());
        }
        else if(dialog.Operation=="return")
        {
            if(existing is null)return;
            workspace.CreateReturnPortal(mapId,existing["id"]!.ToString());
        }
        else workspace.PutPortal(mapId,existing?["id"]?.ToString(),dialog.TileX,dialog.TileY,dialog.TargetMapId,dialog.TargetArrivalId,dialog.Activation);
        RefreshMaps();
    }
    private static string? Ask(string title,string initial)
    {
        using var dialog=new Form{Text=title,ClientSize=new Size(400,110),StartPosition=FormStartPosition.CenterParent,FormBorderStyle=FormBorderStyle.FixedDialog,MinimizeBox=false,MaximizeBox=false};
        var input=new TextBox{Left=12,Top=12,Width=375,Text=initial,MaxLength=160};var ok=new Button{Text="OK",Left=220,Top=55,DialogResult=DialogResult.OK};var cancel=new Button{Text="Cancel",Left=305,Top=55,DialogResult=DialogResult.Cancel};dialog.Controls.AddRange([input,ok,cancel]);dialog.AcceptButton=ok;dialog.CancelButton=cancel;return dialog.ShowDialog()==DialogResult.OK?input.Text:null;
    }
    private void ResizeMap()
    {
        if(selected is null)return;var doc=workspace.Get(selected);var map=doc.Model;
        var input=Ask("Dimensions: width x height",$"{map["width"]} x {map["height"]}");if(input is null)return;
        var parts=input.ToLowerInvariant().Split('x',StringSplitOptions.TrimEntries);if(parts.Length!=2||!int.TryParse(parts[0],out var w)||!int.TryParse(parts[1],out var h))throw new InvalidOperationException("Enter width x height, for example 20 x 16.");
        MapDocument.Resize(map,w,h); // Validate before asking to commit; never silently remove placed objects.
        if(MessageBox.Show(this,$"Resize to {w} × {h}? Geometry beyond the new sealed border will be removed. Placed objects have been checked; incoming destinations will be checked at save. Undo restores the old dimensions.","Resize preview",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;
        doc.Apply(map);workspace.Commit();RefreshMaps();
    }
    private void Save()
    {
        workspace.Preflight();
        var root=new DirectoryInfo(AppContext.BaseDirectory);while(root is not null&&!File.Exists(Path.Combine(root.FullName,"tools","validate-map-workspace.mjs")))root=root.Parent;
        if(root is null)throw new InvalidOperationException("Canonical map validator is missing. Run this editor from the source workspace (tools/validate-map-workspace.mjs is required).");
        var payload=JsonNode.Parse(workspace.Snapshot())!.AsObject();payload["start"]=JsonNode.Parse(File.ReadAllText(workspace.ProjectPath))!["start"]!.DeepClone();
        if(workspace.ResourceCatalog is not null)payload["resourceCatalog"]=JsonNode.Parse(File.ReadAllText(workspace.ResourceCatalog.FilePath));
        using var process=new Process{StartInfo=new ProcessStartInfo("node"){WorkingDirectory=root.FullName,UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true}};
        process.StartInfo.ArgumentList.Add("--experimental-strip-types");process.StartInfo.ArgumentList.Add(Path.Combine(root.FullName,"tools","validate-map-workspace.mjs"));
        process.Start();var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();process.StandardInput.Write(payload.ToJsonString());process.StandardInput.Close();
        if(!process.WaitForExit(30000)){process.Kill(true);throw new InvalidOperationException("Map validation timed out. Nothing was saved.");}
        if(process.ExitCode!=0)throw new InvalidOperationException(error.GetAwaiter().GetResult());
        workspace.Save();RefreshMaps();status.Text=output.GetAwaiter().GetResult().Trim()+" Saved all maps.";
    }
}

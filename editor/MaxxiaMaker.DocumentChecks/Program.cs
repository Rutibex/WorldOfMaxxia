using System.Text;
using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

if (args.Length != 1) { Console.Error.WriteLine("Pass the valid-unknown-fields.maxxia fixture path."); return 2; }
var baseline = File.ReadAllText(args[0]);
var sandbox = Path.Combine(Path.GetTempPath(), "maxxia-docchecks-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(sandbox); var passed = 0;
void Ok(bool condition, string message = "Assertion failed") { if (!condition) throw new Exception(message); }
void Same(byte[] a, byte[] b) => Ok(a.SequenceEqual(b), "Original byte content changed unexpectedly");
string Edit(ProjectDocument doc, string title, int? revision = null)
{
    var json = JsonNode.Parse(doc.Text)!.AsObject(); json["title"] = title;
    if (revision.HasValue) json["contentRevision"] = revision.Value;
    return json.ToJsonString();
}
void Error(string code, Action action)
{
    try { action(); } catch (DocumentException e) when (e.Code == code) { return; }
    throw new Exception("Expected " + code);
}
void Check(string name, Action<string, string> action)
{
    var dir = Path.Combine(sandbox, passed.ToString()); Directory.CreateDirectory(dir);
    var file = Path.Combine(dir, "game.maxxia"); File.WriteAllText(file, baseline, new UTF8Encoding(false));
    action(dir, file); passed++; Console.WriteLine("PASS: " + name);
}
try
{
    Check("open and clean save preserve original bytes and create no backup", (_, file) =>
    {
        var raw = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(baseline.Replace("\n", "\r\n"))).ToArray(); File.WriteAllBytes(file, raw);
        var d = new DocumentWorkspace().Open(file); Ok(!d.IsDirty && !d.Save()); Same(raw, File.ReadAllBytes(file)); Ok(!File.Exists(file + ".bak"));
    });
    Check("grouped multi-field edit is one undo command", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var original = d.Text;
        d.Apply("Project settings", Edit(d, "Updated", 12)); Ok(d.IsDirty && d.Model.ContentRevision == 12);
        Ok(d.Undo() && d.Text == original && !d.IsDirty && !d.CanUndo); Ok(d.Redo() && d.Model.Title == "Updated");
    });
    Check("invalid apply cannot mutate document or history", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var before = d.Text;
        try { d.Apply("Bad draft", "{}"); throw new Exception("Invalid draft accepted"); } catch (ManifestException) { }
        Ok(d.Text == before && !d.CanUndo && !d.IsDirty);
    });
    Check("cancelled draft stays isolated from accepted state and disk", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var raw = File.ReadAllBytes(file); var draft = Edit(d, "Cancelled");
        Ok(draft != d.Text); Ok(!d.Save() && !d.IsDirty); Same(raw, File.ReadAllBytes(file));
    });
    Check("save/reopen preserves nested unknown fields and Unicode", (_, file) =>
    {
        var w = new DocumentWorkspace(); var d = w.Open(file); d.Apply("Title", Edit(d, "Maxxia 🧙 — 魔法")); d.Save();
        var fresh = new DocumentWorkspace().Open(file); var a = JsonNode.Parse(baseline)!; var b = JsonNode.Parse(fresh.Text)!;
        Ok(JsonNode.DeepEquals(a["futureOptional"], b["futureOptional"])); Ok(JsonNode.DeepEquals(a["content"], b["content"])); Ok(fresh.Model.Title == "Maxxia 🧙 — 魔法");
    });
    Check("dirty tracking follows content savepoint through undo/redo", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); d.Apply("A", Edit(d, "A")); d.Save();
        d.Apply("B", Edit(d, "B")); Ok(d.IsDirty); d.Undo(); Ok(!d.IsDirty); d.Undo(); Ok(d.IsDirty); d.Redo(); Ok(!d.IsDirty);
    });
    Check("new accepted edit after undo invalidates redo branch", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); d.Apply("A", Edit(d, "A")); d.Apply("B", Edit(d, "B")); d.Undo(); d.Apply("C", Edit(d, "C")); Ok(!d.CanRedo && d.Model.Title == "C");
    });
    Check("whitespace-only apply does not dirty or allocate undo", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); Ok(!d.Apply("Formatting", JsonNode.Parse(d.Text)!.ToJsonString())); Ok(!d.IsDirty && !d.CanUndo);
    });
    Check("successful save retains exact previous bytes in bounded .bak", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var before = File.ReadAllBytes(file); d.Apply("A", Edit(d, "A")); d.Save(); Same(before, File.ReadAllBytes(file + ".bak"));
        var saved = File.ReadAllBytes(file); d.Apply("B", Edit(d, "B")); d.Save(); Same(saved, File.ReadAllBytes(file + ".bak")); Ok(!d.IsDirty);
    });
    Check("external same-length edits with unchanged timestamp are detected", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); d.Apply("Local", Edit(d, "Local")); var timestamp = File.GetLastWriteTimeUtc(file);
        var external = baseline.Replace("World of Maxxia", "Other of Maxxia"); File.WriteAllText(file, external); File.SetLastWriteTimeUtc(file, timestamp);
        Ok(d.ExternalChange() is not null); Error("E_CONFLICT", () => d.Save()); Ok(File.ReadAllText(file) == external && d.IsDirty);
    });
    Check("deleted external file is not silently recreated", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); d.Apply("Local", Edit(d, "Local")); File.Delete(file); Error("E_CONFLICT", () => d.Save()); Ok(!File.Exists(file) && d.IsDirty);
    });
    Check("staged write failure preserves original, backup and dirty work", (dir, file) =>
    {
        File.WriteAllText(file + ".bak", "older backup"); var original = File.ReadAllBytes(file);
        var store = new AtomicFileStore(stage => { if (stage == SaveStage.AfterTempFlushed) throw new IOException("Simulated disk failure"); });
        var d = new DocumentWorkspace(store).Open(file); d.Apply("Change", Edit(d, "Change"));
        try { d.Save(); throw new Exception("Fault not raised"); } catch (IOException) { }
        Same(original, File.ReadAllBytes(file)); Ok(File.ReadAllText(file + ".bak") == "older backup" && d.IsDirty); Ok(!Directory.EnumerateFiles(dir, "*.tmp").Any());
    });
    Check("external edit while replacement is staged blocks commit", (_, file) =>
    {
        var external = baseline.Replace("World of Maxxia", "External world");
        var d = new DocumentWorkspace(new AtomicFileStore(stage => { if (stage == SaveStage.BeforeCommit) File.WriteAllText(file, external); })).Open(file);
        d.Apply("Local", Edit(d, "Local")); Error("E_CONFLICT", () => d.Save()); Ok(File.ReadAllText(file) == external && d.IsDirty);
    });
    Check("copy cannot overwrite an existing target", (dir, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var target = Path.Combine(dir, "copy.maxxia"); File.WriteAllText(target, "keep me"); Error("E_TARGET_EXISTS", () => d.SaveCopy(target)); Ok(File.ReadAllText(target) == "keep me");
    });
    Check("Save Copy retains identity and leaves source dirty/untouched", (dir, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var original = File.ReadAllBytes(file); d.Apply("Unsaved", Edit(d, "Unsaved"));
        var copy = Path.Combine(dir, "copy.maxxia"); d.SaveCopy(copy); var m = ManifestReader.ReadFile(copy);
        Ok(m.ProjectId == d.Model.ProjectId && m.Title == "Unsaved" && d.IsDirty); Same(original, File.ReadAllBytes(file));
    });
    Check("clone changes identity, retains metadata, and shares relative content", (dir, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var target = Path.Combine(dir, "clone.maxxia"); d.CloneAsNewGame(target); var clone = ManifestReader.ReadFile(target);
        Ok(clone.ProjectId != d.Model.ProjectId && clone.Content.Town == d.Model.Content.Town && !d.IsDirty);
        Ok(clone.AdditionalFields!.ContainsKey("futureOptional"));
        var other = Path.Combine(dir, "elsewhere"); Directory.CreateDirectory(other); Error("E_LOCATION", () => d.CloneAsNewGame(Path.Combine(other, "bad.maxxia")));
    });
    Check("invalid reload preserves current accepted work and undo", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); d.Apply("Local", Edit(d, "Local")); File.WriteAllText(file, "{}");
        try { d.Reload(true); throw new Exception("Bad reload accepted"); } catch (ManifestException) { }
        Ok(d.Model.Title == "Local" && d.CanUndo && d.IsDirty);
    });
    Check("reload requires explicit discard and resets history only on success", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); d.Apply("Local", Edit(d, "Local")); Error("E_DIRTY", () => d.Reload()); d.Reload(true); Ok(!d.IsDirty && !d.CanUndo && !d.CanRedo);
    });
    Check("workspace de-duplicates paths and protects dirty close", (_, file) =>
    {
        var w = new DocumentWorkspace(); var d = w.Open(file); Ok(ReferenceEquals(d, w.Open(Path.Combine(Path.GetDirectoryName(file)!, ".", Path.GetFileName(file)))));
        d.Apply("Local", Edit(d, "Local")); Error("E_DIRTY", () => w.Close(d)); Ok(w.Documents.Count == 1); w.Close(d, true); Ok(w.Documents.Count == 0);
    });
    Check("Save All preflights all conflicts before writing any file", (dir, file) =>
    {
        var second = Path.Combine(dir, "second.maxxia"); File.WriteAllText(second, baseline); var w = new DocumentWorkspace(); var a = w.Open(file); var b = w.Open(second);
        a.Apply("A", Edit(a, "A")); b.Apply("B", Edit(b, "B")); var before = File.ReadAllBytes(file); File.WriteAllText(second, baseline + " ");
        var result = w.SaveAll(); Ok(result.Saved.Count == 0 && result.Pending.Count == 2 && result.Failure?.Code == "E_CONFLICT"); Same(before, File.ReadAllBytes(file));
    });
    Check("Save All reports partial I/O success and retains pending work", (dir, file) =>
    {
        var second = Path.Combine(dir, "second.maxxia"); File.WriteAllText(second, baseline); var stages = 0;
        var w = new DocumentWorkspace(new AtomicFileStore(stage => { if (stage == SaveStage.AfterTempFlushed && ++stages == 2) throw new IOException("Second write failed"); }));
        var a = w.Open(file); var b = w.Open(second); a.Apply("A", Edit(a, "A")); b.Apply("B", Edit(b, "B"));
        var result = w.SaveAll(); Ok(result.Saved.Count == 1 && result.Pending.Count == 1 && result.Failure is not null); Ok(!a.IsDirty && b.IsDirty); Ok(ManifestReader.ReadFile(second).Title != "B");
    });
    Check("history is bounded and exposed models cannot mutate accepted text", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var model = d.Model; model.AdditionalFields!.Clear(); Ok(d.Model.AdditionalFields!.ContainsKey("futureOptional"));
        for (var i = 0; i < 120; i++) d.Apply("Step " + i, Edit(d, "Title " + i));
        var count = 0; while (d.Undo()) count++; Ok(count == 100);
    });
    Check("direct identity edits are rejected; clone is the identity operation", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); var json = JsonNode.Parse(d.Text)!; json["projectId"] = "project_different"; Error("E_IDENTITY", () => d.Apply("Identity", json.ToJsonString())); Ok(!d.IsDirty);
    });
    Check("real filesystem commit failure preserves target and removes staging", (dir, file) =>
    {
        Directory.CreateDirectory(file + ".bak"); var raw = File.ReadAllBytes(file); var d = new DocumentWorkspace().Open(file);
        d.Apply("Changed", Edit(d, "Changed"));
        try { d.Save(); throw new Exception("Expected commit failure"); } catch (IOException) { }
        Same(raw, File.ReadAllBytes(file)); Ok(d.IsDirty && !Directory.EnumerateFiles(dir, "*.tmp").Any());
    });
    Check("cooperative save lock blocks a competing writer without touching source", (_, file) =>
    {
        var d = new DocumentWorkspace().Open(file); d.Apply("Changed", Edit(d, "Changed")); var raw = File.ReadAllBytes(file);
        using var gate = new FileStream(file + ".save-lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        try { d.Save(); throw new Exception("Expected lock failure"); } catch (IOException) { }
        Same(raw, File.ReadAllBytes(file)); Ok(d.IsDirty);
    });
    Check("MM17 map gesture undo and unknown metadata survives save/reopen", (dir, _) =>
    {
        var file=Path.Combine(dir,"map.json");var map=MapDocument.Create("map_check","Check",12,10);map["custom"]=new JsonObject{["keep"]=true};
        File.WriteAllText(file,MapDocument.Serialize(map));var doc=new MapDocument(file);
        var edited=doc.Model;MapDocument.Paint(edited,Enumerable.Range(2,6).Select(x=>(x,4)),'#');doc.Apply(edited);
        Ok(doc.IsDirty);Ok(doc.Model["geometry"]!["rows"]![4]!.ToString()[4]=='#');doc.Undo();Ok(!doc.IsDirty);doc.Redo();doc.Save();
        var reopened=new MapDocument(file);Ok(reopened.Model["custom"]!["keep"]!.GetValue<bool>());Ok(reopened.Model["geometry"]!["rows"]![4]!.ToString()[4]=='#');
    });
    Check("MM17 map perimeter, arrival and shrink protection", (dir, _) =>
    {
        var map=MapDocument.Create("map_check","Check",12,10);
        MapDocument.Paint(map,[(0,0),(1,1),(4,4)],'#');Ok(map["geometry"]!["rows"]![1]!.ToString()[1]=='.');Ok(map["geometry"]!["rows"]![0]!.ToString()[0]=='#');
        var arrival=map["arrivals"]![0]!;arrival["x"]=10;arrival["y"]=8;
        try{MapDocument.Resize(map,8,8);throw new Exception("Expected rejected resize");}catch(InvalidOperationException){}
        Ok(MapDocument.Number(map,"width")==12);
    });
    Check("MM17 map conflict preserves external bytes", (dir, _) =>
    {
        var path=Path.Combine(dir,"map.json");File.WriteAllText(path,MapDocument.Serialize(MapDocument.Create("map_check","Check")));
        var doc=new MapDocument(path);var map=doc.Model;map["name"]="New name";doc.Apply(map);
        File.AppendAllText(path," ");var bytes=File.ReadAllBytes(path);Error("E_CONFLICT",doc.Save);Same(bytes,File.ReadAllBytes(path));Ok(doc.IsDirty);
    });
    Check("MM17 map workspace create/duplicate/rename/remove/undo/save", (dir, file) =>
    {
        var project=JsonNode.Parse(baseline)!.AsObject();project["content"]!["kind"]="map-index";project["content"]!["index"]="index.json";
        project["start"]!["map"]!["id"]="map_check";project["start"]!["x"]=1;project["start"]!["y"]=1;
        File.WriteAllText(file,project.ToJsonString());var mapFile=Path.Combine(dir,"map_check.json");
        File.WriteAllText(mapFile,MapDocument.Serialize(MapDocument.Create("map_check","Original")));
        File.WriteAllText(Path.Combine(dir,"index.json"),"{\"format\":\"maxxia-map-index\",\"version\":1,\"extra\":true,\"maps\":[{\"id\":\"map_check\",\"path\":\"map_check.json\"}]}");
        var ws=new MapWorkspace(file,ManifestReader.Read(File.ReadAllText(file)));var id=ws.Add("New map");var duplicate=ws.Add("Copy",id);
        Ok(id!=duplicate);ws.Rename(id,"Renamed");ws.Undo();Ok(ws.Get(id).Model["name"]!.ToString()=="New map");ws.Redo();
        ws.Remove(duplicate);Ok(ws.Maps.Count()==2);ws.Undo();Ok(ws.Maps.Count()==3);ws.Redo();ws.Save();
        var reopened=new MapWorkspace(file,ManifestReader.Read(File.ReadAllText(file)));Ok(reopened.Maps.Count()==2);Ok(reopened.Index["extra"]!.GetValue<bool>());Ok(!reopened.IsDirty);
        var retained=ws.Get(id).FilePath;ws.Remove(id);ws.Save();Ok(File.Exists(retained));
        try{ws.Remove("map_check");throw new Exception("Expected protected map");}catch(InvalidOperationException){}
    });
    Check("MM17 official project preflight and MM16 database spatial adapters", (dir, _) =>
    {
        var root=Path.GetFullPath(Path.Combine(Path.GetDirectoryName(args[0])!,"../../.."));
        var path=Path.Combine(root,"engine/world-of-maxxia/public/WorldOfMaxxia.maxxia");var manifest=ManifestReader.Read(File.ReadAllText(path));
        var ws=new MapWorkspace(path,manifest);ws.Preflight();Ok(!ws.IsDirty);
        var entries=MapIndexReader.Read(path,manifest);var projectRoot=Path.GetDirectoryName(path)!;
        JsonObject Read(string relative)=>JsonNode.Parse(File.ReadAllText(Path.Combine(projectRoot,relative)))!.AsObject();
        var groups=EncounterDatabaseReader.ReadGroups(File.ReadAllText(Path.Combine(projectRoot,manifest.Content.EncounterGroups)));
        var placements=EncounterDatabaseReader.ReadPlacements(File.ReadAllText(Path.Combine(projectRoot,manifest.Content.EncounterPlacements)));
        var monsters=Read(manifest.Content.Monsters)["monsters"]!.AsArray().Select(n=>n!["id"]!.ToString()).ToArray();
        EncounterDatabaseReader.ValidateLinks(groups,placements,monsters,entries);
        var tables=LootDatabaseReader.ReadTables(File.ReadAllText(Path.Combine(projectRoot,manifest.Content.LootTables)));
        var pickups=LootDatabaseReader.ReadPickups(File.ReadAllText(Path.Combine(projectRoot,manifest.Content.GroundPickups)));
        var items=Read(manifest.Content.Items)["items"]!.AsArray().Select(n=>n!["id"]!.ToString()).ToArray();
        LootDatabaseReader.ValidateLinks(tables,pickups,items,placements["placements"]!.AsArray().Select(n=>n!["id"]!.ToString()).ToArray(),entries);
    });
    Check("MM18 named arrival transfer, follow move, undo and save/reopen", (dir, file) =>
    {
        var project=JsonNode.Parse(baseline)!.AsObject();project["content"]!["kind"]="map-index";project["content"]!["index"]="index.json";
        project["start"]!["map"]!["id"]="map_landing";project["start"]!["x"]=1;project["start"]!["y"]=1;
        File.WriteAllText(file,project.ToJsonString());
        File.WriteAllText(Path.Combine(dir,"map_landing.json"),MapDocument.Serialize(MapDocument.Create("map_landing","Landing",9,7)));
        File.WriteAllText(Path.Combine(dir,"map_tower.json"),MapDocument.Serialize(MapDocument.Create("map_tower","Tower",9,7)));
        File.WriteAllText(Path.Combine(dir,"index.json"),"{\"format\":\"maxxia-map-index\",\"version\":1,\"maps\":[{\"id\":\"map_landing\",\"path\":\"map_landing.json\"},{\"id\":\"map_tower\",\"path\":\"map_tower.json\"}]}");
        var ws=new MapWorkspace(file,ManifestReader.Read(File.ReadAllText(file)));
        var arrival=ws.PutArrival("map_tower",null,"Upper landing",3,4,2);
        var portal=ws.PutPortal("map_landing",null,4,3,"map_tower",arrival,"step");
        ws.Preflight();
        var initial=MapTransfers.Portal(ws.Get("map_landing").Model,portal)!;
        Ok(initial["targetX"]!.GetValue<int>()==3&&initial["targetFacing"]!.GetValue<int>()==2);
        ws.PutArrival("map_tower",arrival,"Moved landing",5,2,3);
        var updated=MapTransfers.Portal(ws.Get("map_landing").Model,portal)!;
        Ok(updated["targetX"]!.GetValue<int>()==5&&updated["targetY"]!.GetValue<int>()==2&&updated["targetFacing"]!.GetValue<int>()==3);
        ws.Undo();Ok(MapTransfers.Portal(ws.Get("map_landing").Model,portal)!["targetX"]!.GetValue<int>()==3);
        ws.Redo();ws.Save();
        var reopened=new MapWorkspace(file,ManifestReader.Read(File.ReadAllText(file)));
        Ok(MapTransfers.Portal(reopened.Get("map_landing").Model,portal)!["targetArrivalId"]!.ToString()==arrival);
        Ok(MapTransfers.Arrival(reopened.Get("map_tower").Model,arrival)!["x"]!.GetValue<int>()==5);
        try{reopened.RemoveArrival("map_tower",arrival);throw new Exception("Removal should be blocked by inbound reference");}catch(InvalidOperationException){}
    });
    Check("MM18 reciprocal transfer helper preserves source arrival and rejects duplicate destination", (dir, file) =>
    {
        var project=JsonNode.Parse(baseline)!.AsObject();project["content"]!["kind"]="map-index";project["content"]!["index"]="index.json";
        project["start"]!["map"]!["id"]="map_first";project["start"]!["x"]=1;project["start"]!["y"]=1;
        File.WriteAllText(file,project.ToJsonString());
        foreach(var mapId in new[]{"map_first","map_second"})File.WriteAllText(Path.Combine(dir,mapId+".json"),MapDocument.Serialize(MapDocument.Create(mapId,mapId,9,7)));
        File.WriteAllText(Path.Combine(dir,"index.json"),"{\"format\":\"maxxia-map-index\",\"version\":1,\"maps\":[{\"id\":\"map_first\",\"path\":\"map_first.json\"},{\"id\":\"map_second\",\"path\":\"map_second.json\"}]}");
        var ws=new MapWorkspace(file,ManifestReader.Read(File.ReadAllText(file)));
        var secondArrival=ws.PutArrival("map_second",null,"Tower step",3,3,1);
        var outId=ws.PutPortal("map_first",null,4,3,"map_second",secondArrival,"interact");
        ws.CreateReturnPortal("map_first",outId);ws.Preflight();
        var source=ws.Get("map_first").Model;var target=ws.Get("map_second").Model;
        var sourceArrival=source["arrivals"]!.AsArray().First(a=>MapDocument.Number(a!,"x")==4&&MapDocument.Number(a!,"y")==3)!["id"]!.ToString();
        Ok(target["objects"]!["portals"]!.AsArray().Count==1);
        Ok(target["objects"]!["portals"]![0]!["targetArrivalId"]!.ToString()==sourceArrival);
        try{ws.CreateReturnPortal("map_first",outId);throw new Exception("Expected occupied return square error");}catch(InvalidOperationException){}
        ws.Undo();Ok(ws.Get("map_second").Model["objects"]!["portals"]!.AsArray().Count==0);
        ws.Redo();Ok(ws.Get("map_second").Model["objects"]!["portals"]!.AsArray().Count==1);
    });
    Check("MM19 reusable profiles/material painting, undo and safe save", (dir,file) =>
    {
        var manifest=JsonNode.Parse(baseline)!.AsObject();
        manifest["content"]!["kind"]="map-index";manifest["content"]!["index"]="index.json";manifest["content"]!["environments"]="environments.json";
        manifest["start"]!["map"]!["id"]="map_first";manifest["start"]!["x"]=3;manifest["start"]!["y"]=3;
        File.WriteAllText(file,manifest.ToJsonString());
        File.WriteAllText(Path.Combine(dir,"index.json"),"""{"format":"maxxia-map-index","version":1,"maps":[{"id":"map_first","path":"map_first.json"},{"id":"map_second","path":"map_second.json"}]}""");
        foreach(var id in new[]{"map_first","map_second"})File.WriteAllText(Path.Combine(dir,id+".json"),MapDocument.Serialize(MapDocument.Create(id,id,9,7)));
        File.WriteAllText(Path.Combine(dir,"environments.json"),MapDocument.Serialize(EnvironmentProfiles.Default()));
        var ws=new MapWorkspace(file,ManifestReader.Read(File.ReadAllText(file)));
        var db=ws.Environments.DeepClone().AsObject();var p=EnvironmentProfiles.Profile(db,"environment_default");
        p["name"]="Edited shared profile";p["materials"]!.AsArray().Add(new JsonObject{["id"]="material_wall_alt",["name"]="Alternate stone",["surface"]="wall",["resourceId"]=null});
        ws.SetEnvironmentDatabase(db);
        foreach(var id in new[]{"map_first","map_second"})
        {
            var map=ws.Get(id).Model;EnvironmentProfiles.Paint(map,[(0,2),(0,3)],"wall","material_wall_alt");ws.Get(id).Apply(map);ws.Commit();
        }
        Ok(ws.IsDirty);Ok(ws.Get("map_first").Model["materials"]!["wall"]!["overrides"]!.AsArray().Count==2);
        ws.SetDefaultMaterial("map_first","wall","material_wall_alt");
        ws.Undo();Ok(ws.Get("map_first").Model["materials"]!["wall"]!["default"]!.ToString()=="material_wall_default");
        ws.Redo();Ok(ws.Get("map_first").Model["materials"]!["wall"]!["default"]!.ToString()=="material_wall_alt");
        ws.Save();var reopened=new MapWorkspace(file,ManifestReader.Read(File.ReadAllText(file)));
        Ok(!reopened.IsDirty);Ok(EnvironmentProfiles.Profile(reopened.Environments,"environment_default")["name"]!.ToString()=="Edited shared profile");
        Ok(reopened.Get("map_second").Model["materials"]!["wall"]!["overrides"]!.AsArray().Count==2);
    });
    Check("MM19 rejects missing/wrong-surface materials and unsafe profile changes", (dir,file) =>
    {
        var db=EnvironmentProfiles.Default();var map=MapDocument.Create("map_check","Check",9,7);
        var p=EnvironmentProfiles.Profile(db,"environment_default");
        p["materials"]!.AsArray().Add(new JsonObject{["id"]="material_floor_extra",["name"]="Stone",["surface"]="floor",["resourceId"]=null});
        EnvironmentProfiles.Validate(db);EnvironmentProfiles.ValidateMap(map,db);
        EnvironmentProfiles.Paint(map,[(2,2)],"floor","material_floor_extra");
        Ok(map["materials"]!["floor"]!["overrides"]!.AsArray().Count==1);
        try{EnvironmentProfiles.Paint(map,[(0,0)],"floor","material_floor_extra");}catch(InvalidOperationException){}
        Ok(map["materials"]!["floor"]!["overrides"]!.AsArray().Count==1);
        map["materials"]!["wall"]!["default"]="material_floor_extra";
        try{EnvironmentProfiles.ValidateMap(map,db);throw new Exception("Expected surface mismatch");}catch(InvalidOperationException){}
    });
    Console.WriteLine($"PASS: {passed} document/workspace scenarios; original-byte, conflict, undo and failure behavior verified.");
    return 0;
}
finally { Directory.Delete(sandbox, recursive: true); }

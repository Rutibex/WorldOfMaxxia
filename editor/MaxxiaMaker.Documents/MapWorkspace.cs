using System.Text;
using System.Text.Json.Nodes;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker.Documents;

/// <summary>Project map/index session; unindexing retains source bytes for recovery.</summary>
public sealed class MapWorkspace
{
    private readonly AtomicFileStore store=new(maxBytes:64*1024);
    private string fingerprint, savedIndex;
    private readonly Dictionary<string,MapDocument> documents=[];
    private readonly List<string> history=[];
    private readonly AtomicFileStore environmentStore=new(maxBytes:128*1024);
    private string? environmentFingerprint,environmentSaved;
    public string? EnvironmentPath {get;}
    public JsonObject Environments {get;private set;}
    public ResourceCatalogDocument? ResourceCatalog {get;}
    private int cursor;
    public string IndexPath {get;}
    public JsonObject Index {get;private set;}
    public string ProjectPath {get;}
    public ProjectManifest Manifest {get;}
    public IEnumerable<(string id,MapDocument document)> Maps => Index["maps"]!.AsArray().Select(n=>(n!["id"]!.ToString(),documents[n["id"]!.ToString()]));
    public bool IsDirty=>Index.ToJsonString()!=savedIndex||Maps.Any(m=>m.document.IsDirty)||(EnvironmentPath is not null&&EnvironmentSavedText()!=environmentSaved);
    public bool CanUndo=>cursor>0;
    public bool CanRedo=>cursor+1<history.Count;
    public MapWorkspace(string projectPath,ProjectManifest manifest)
    {
        ProjectPath=projectPath;Manifest=manifest;
        if(manifest.Content.Kind!="map-index")throw new InvalidOperationException("Map painting requires a map-index project.");
        var entries=MapIndexReader.Read(projectPath,manifest);
        IndexPath=Path.GetFullPath(Path.Combine(Path.GetDirectoryName(projectPath)!,manifest.Content.Index!));
        var snapshot=store.Read(IndexPath);fingerprint=snapshot.Fingerprint;
        Index=JsonNode.Parse(Encoding.UTF8.GetString(snapshot.Bytes).TrimStart('\uFEFF'))!.AsObject();savedIndex=Index.ToJsonString();
        foreach(var entry in entries)documents.Add(entry.Id,new MapDocument(entry.FilePath));
        ResourceCatalog=ResourceCatalogReader.Read(projectPath,manifest);
        if(manifest.Content.Environments is { } environmentFile)
        {
            var root=Path.GetDirectoryName(Path.GetFullPath(projectPath))!;
            if(environmentFile.Split('/').Any(x=>x==".."||x==".")||Path.IsPathRooted(environmentFile))throw new InvalidOperationException("Unsafe environment database path.");
            EnvironmentPath=Path.GetFullPath(Path.Combine(root,environmentFile.Replace('/',Path.DirectorySeparatorChar)));
            if(!EnvironmentPath.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Environment file escapes project.");
            var snapshot=environmentStore.Read(EnvironmentPath);environmentFingerprint=snapshot.Fingerprint;
            Environments=JsonNode.Parse(System.Text.Encoding.UTF8.GetString(snapshot.Bytes).TrimStart('\uFEFF'))!.AsObject();
        }
        else Environments=EnvironmentProfiles.Default();
        EnvironmentProfiles.Validate(Environments,ResourceCatalog);environmentSaved=EnvironmentSavedText();
        foreach(var (_,doc) in Maps)EnvironmentProfiles.ValidateMap(doc.Model,Environments);
        history.Add(Snapshot());
    }
    public MapDocument Get(string id)=>documents[id];
    private string EnvironmentSavedText()=>MapDocument.Serialize(Environments);
    public string Snapshot()=>new JsonObject { ["index"]=Index.DeepClone(),["maps"]=new JsonObject(Maps.Select(m=>new KeyValuePair<string,JsonNode?>(m.id,m.document.Model))),["environments"]=Environments.DeepClone() }.ToJsonString();
    public void SetEnvironmentDatabase(JsonObject database)
    {
        if(EnvironmentPath is null)throw new InvalidOperationException("This older project has no content.environments file. Configure the environment database in its manifest first.");
        EnvironmentProfiles.Validate(database,ResourceCatalog);
        foreach(var (_,doc) in Maps)EnvironmentProfiles.ValidateMap(doc.Model,database);
        Environments=database.DeepClone().AsObject();Commit();
    }
    public void SetDefaultMaterial(string mapId,string surface,string materialId)
    {
        if(surface is not ("floor" or "wall" or "ceiling"))throw new InvalidOperationException("Unknown surface.");
        var map=Get(mapId).Model;var profile=EnvironmentProfiles.Profile(Environments,map["settings"]!["environmentId"]!.ToString());
        if(!profile["materials"]!.AsArray().Any(m=>m!["surface"]!.ToString()==surface&&m["id"]!.ToString()==materialId))throw new InvalidOperationException("Material must belong to this map's environment profile and surface.");
        map["materials"]![surface]!["default"]=materialId;
        var overrides=map["materials"]![surface]!["overrides"]!.AsArray();
        for(int i=overrides.Count-1;i>=0;i--)if(overrides[i]!["materialId"]!.ToString()==materialId)overrides.RemoveAt(i);
        EnvironmentProfiles.ValidateMap(map,Environments);Get(mapId).Apply(map);Commit();
    }
    public void SetMapEnvironment(string mapId,string profileId)
    {
        var map=Get(mapId).Model;var profile=EnvironmentProfiles.Profile(Environments,profileId);
        map["settings"]!["environmentId"]=profileId;
        foreach(var surface in new[]{"floor","wall","ceiling"})
        {
            var materials=profile["materials"]!.AsArray().Where(m=>m!["surface"]!.ToString()==surface).Select(m=>m!["id"]!.ToString()).ToArray();
            var layer=map["materials"]![surface]!;
            if(!materials.Contains(layer["default"]!.ToString()))layer["default"]=materials[0];
            var overrides=layer["overrides"]!.AsArray();
            if(overrides.Any(n=>!materials.Contains(n!["materialId"]!.ToString())))
                throw new InvalidOperationException($"The new profile has no matching {surface} material for an existing override. Remove/repaint those overrides explicitly before switching.");
        }
        EnvironmentProfiles.ValidateMap(map,Environments);Get(mapId).Apply(map);Commit();
    }
    public void Commit()
    {
        var next=Snapshot();if(next==history[cursor])return;
        history.RemoveRange(cursor+1,history.Count-cursor-1);history.Add(next);cursor++;
        if(history.Count>100){history.RemoveAt(0);cursor--;}
    }
    private void Restore(string text)
    {
        var snapshot=JsonNode.Parse(text)!;Index=snapshot["index"]!.DeepClone().AsObject();Environments=snapshot["environments"]!.DeepClone().AsObject();
        foreach(var pair in snapshot["maps"]!.AsObject())documents[pair.Key].Apply(pair.Value!.AsObject());
    }
    public void Undo(){if(CanUndo)Restore(history[--cursor]);}
    public void Redo(){if(CanRedo)Restore(history[++cursor]);}
    public string Add(string name,string? sourceId=null)
    {
        if(string.IsNullOrWhiteSpace(name)||name.Length>160)throw new InvalidOperationException("Use a name of 1–160 characters.");
        if(Maps.Count()>=20)throw new InvalidOperationException("A project supports at most 20 maps.");
        var id="map_"+Guid.NewGuid().ToString("N");
        var map=sourceId is null?MapDocument.Create(id,name):Get(sourceId).Model;
        if(sourceId is not null)
        {
            // Local object IDs and any references to them are remapped together. Canonical arrival_start remains fixed.
            var remap=new Dictionary<string,string>{{sourceId,id}};
            foreach(var node in MapDocument.Positioned(map))
                if(node["id"] is {} local&&local.ToString()!="arrival_start")remap.TryAdd(local.ToString(),"obj_"+Guid.NewGuid().ToString("N"));
            Remap(map,remap);
        }
        map["id"]=id;map["name"]=name;
        var path=id+".json";documents.Add(id,new MapDocument(Path.Combine(Path.GetDirectoryName(IndexPath)!,path),map));
        Index["maps"]!.AsArray().Add(new JsonObject{["id"]=id,["path"]=path});Commit();return id;
    }
    private static void Remap(JsonNode node,Dictionary<string,string> replacements)
    {
        if(node is JsonObject obj)foreach(var key in obj.Select(p=>p.Key).ToArray())
        {var value=obj[key];if(value is JsonValue scalar&&scalar.TryGetValue<string>(out var text)&&replacements.TryGetValue(text,out var replacement))obj[key]=replacement;else if(value is not null)Remap(value,replacements);}
        else if(node is JsonArray array)for(var i=0;i<array.Count;i++){var value=array[i];if(value is JsonValue scalar&&scalar.TryGetValue<string>(out var text)&&replacements.TryGetValue(text,out var replacement))array[i]=replacement;else if(value is not null)Remap(value,replacements);}
    }
    /// <summary>Create/edit an arrival and synchronize cached destinations in one undo transaction.</summary>
    public string PutArrival(string mapId,string? arrivalId,string name,int x,int y,int facing)
    {
        var edited=Maps.ToDictionary(m=>m.id,m=>m.document.Model);
        var id=MapTransfers.PutArrival(edited[mapId],arrivalId,name,x,y,facing);
        var arrival=MapTransfers.Arrival(edited[mapId],id)!;
        foreach(var map in edited.Values){MapTransfers.SyncInbound(map,mapId,arrival);MapDocument.Validate(map);}
        foreach(var (key,doc) in Maps)doc.Apply(edited[key]);Commit();return id;
    }
    public void RemoveArrival(string mapId,string arrivalId)
    {
        foreach(var (id,doc) in Maps)
            foreach(var portal in doc.Model["objects"]!["portals"]!.AsArray())
                if(portal!["targetMapId"]!.ToString()==mapId&&portal["targetArrivalId"]?.ToString()==arrivalId)
                    throw new InvalidOperationException($"Arrival is used by a transfer in {id}. Redirect or delete that transfer first.");
        var map=Get(mapId).Model;MapTransfers.RemoveArrival(map,arrivalId);Get(mapId).Apply(map);Commit();
    }
    public string PutPortal(string mapId,string? portalId,int x,int y,string targetMapId,string? arrivalId,string activation)
    {
        var target=Get(targetMapId).Model;
        var arrival=arrivalId is null?null:MapTransfers.Arrival(target,arrivalId)??throw new InvalidOperationException("Destination arrival no longer exists.");
        var map=Get(mapId).Model;
        if(arrival is not null)MapTransfers.AssertFloor(target,MapDocument.Number(arrival,"x"),MapDocument.Number(arrival,"y"));
        else
        {
            var existing=portalId is null?null:MapTransfers.Portal(map,portalId);
            if(existing is null||existing["targetMapId"]?.ToString()!=targetMapId)throw new InvalidOperationException("Legacy destination is only available when editing an existing transfer.");
            MapTransfers.AssertFloor(target,MapDocument.Number(existing,"targetX"),MapDocument.Number(existing,"targetY"));
        }
        var id=MapTransfers.PutPortal(map,portalId,x,y,targetMapId,arrival,activation);
        Get(mapId).Apply(map);Commit();return id;
    }
    public void RemovePortal(string mapId,string portalId)
    {
        var map=Get(mapId).Model;MapTransfers.RemovePortal(map,portalId);Get(mapId).Apply(map);Commit();
    }
    public void CreateReturnPortal(string mapId,string portalId)
    {
        var source=Get(mapId).Model;
        var outbound=MapTransfers.Portal(source,portalId)??throw new InvalidOperationException("Unknown outgoing transfer.");
        var targetId=outbound["targetMapId"]!.ToString();
        if(targetId==mapId)throw new InvalidOperationException("For a same-map transfer, create the return link manually.");
        var target=Get(targetId).Model;
        var ax=outbound["targetArrivalId"]?.ToString() is { } arrivalId
            ? MapTransfers.Arrival(target,arrivalId):null;
        var dx=ax is null?MapDocument.Number(outbound,"targetX"):MapDocument.Number(ax,"x");
        var dy=ax is null?MapDocument.Number(outbound,"targetY"):MapDocument.Number(ax,"y");
        MapTransfers.AssertFloor(target,dx,dy);
        if(target["objects"]!["portals"]!.AsArray().Any(p=>MapDocument.Number(p!,"x")==dx&&MapDocument.Number(p!,"y")==dy))
            throw new InvalidOperationException("The destination square already has a transfer. Edit it to point back manually.");
        var sx=MapDocument.Number(outbound,"x");var sy=MapDocument.Number(outbound,"y");
        var sourceArrival=source["arrivals"]!.AsArray().Select(n=>n!.AsObject()).FirstOrDefault(a=>MapDocument.Number(a,"x")==sx&&MapDocument.Number(a,"y")==sy);
        if(sourceArrival is null)
        {
            var arrival=MapTransfers.PutArrival(source,null,("Return from "+target["name"]).Substring(0,Math.Min(100,("Return from "+target["name"]).Length)),sx,sy,0);
            sourceArrival=MapTransfers.Arrival(source,arrival)!;
        }
        MapTransfers.PutPortal(target,null,dx,dy,mapId,sourceArrival,outbound["activation"]?.ToString()??"interact");
        // Commit both maps only after both have passed local validation.
        Get(mapId).Apply(source);Get(targetId).Apply(target);Commit();
    }
    public void Rename(string id,string name){if(string.IsNullOrWhiteSpace(name)||name.Length>160)throw new InvalidOperationException("Use a name of 1–160 characters.");var map=Get(id).Model;map["name"]=name;Get(id).Apply(map);Commit();}
    public void Remove(string id)
    {
        if(Maps.Count()==1)throw new InvalidOperationException("Keep at least one map.");
        if(Manifest.Start.Map.Id==id)throw new InvalidOperationException("Change the starting map in project settings before removing this map.");
        foreach(var (other,doc) in Maps)if(other!=id&&ContainsId(doc.Model,id))throw new InvalidOperationException("Referenced by map "+other+". Resolve its links first.");
        var root=Path.GetDirectoryName(ProjectPath)!;
        var mapFiles=documents.Values.Select(d=>d.FilePath).ToHashSet(AtomicFileStore.PathComparer);
        foreach(var file in ReferencedFiles())
        {
            if(mapFiles.Contains(file)||AtomicFileStore.PathComparer.Equals(file,IndexPath))continue;
            if(ContainsId(JsonNode.Parse(File.ReadAllText(file)),id))throw new InvalidOperationException("Map reference found in "+Path.GetRelativePath(root,file)+". Resolve it before removing the map.");
        }
        var entries=Index["maps"]!.AsArray();entries.Remove(entries.First(n=>n!["id"]!.ToString()==id));Commit();
    }
    private IEnumerable<string> ReferencedFiles()
    {
        var root=Path.GetDirectoryName(ProjectPath)!;
        var content=JsonNode.Parse(File.ReadAllText(ProjectPath))!["content"]!.AsObject();
        return content.Select(p=>p.Value).OfType<JsonValue>().Select(v=>v.TryGetValue<string>(out var text)?text:"")
            .Where(path=>path.EndsWith(".json",StringComparison.Ordinal)&&!path.Contains("..")&&!Path.IsPathRooted(path))
            .Select(path=>Path.GetFullPath(Path.Combine(root,path))).Where(File.Exists);
    }
    private static bool ContainsId(JsonNode? node,string id)=>node switch
    {JsonObject obj=>obj.Any(p=>ContainsId(p.Value,id)),JsonArray array=>array.Any(n=>ContainsId(n,id)),JsonValue scalar=>scalar.TryGetValue<string>(out var text)&&text==id,_=>false};
    public void Preflight()
    {
        store.CheckUnchanged(IndexPath,fingerprint);foreach(var (_,doc) in Maps)doc.Preflight();
        EnvironmentProfiles.Validate(Environments,ResourceCatalog);
        foreach(var (_,doc) in Maps)EnvironmentProfiles.ValidateMap(doc.Model,Environments);
        if(EnvironmentPath is not null)environmentStore.CheckUnchanged(EnvironmentPath,environmentFingerprint);
        var maps=Maps.ToDictionary(m=>m.id,m=>m.document.Model);
        void Floor(string id,int x,int y)
        {
            if(!maps.TryGetValue(id,out var map)||x<0||y<0||x>=MapDocument.Number(map,"width")||y>=MapDocument.Number(map,"height")||map["geometry"]!["rows"]![y]!.ToString()[x]!='.')throw new InvalidOperationException("Blocked or missing map destination: "+id+" at "+x+","+y);
        }
        // Manifest start fields are read losslessly from the current file by the caller's draft resolution.
        var manifest=JsonNode.Parse(File.ReadAllText(ProjectPath))!;var start=manifest["start"]!;
        Floor(start["map"]!["id"]!.ToString(),MapDocument.Number(start,"x"),MapDocument.Number(start,"y"));
        foreach(var (sourceId,map) in maps)foreach(var p in map["objects"]!["portals"]!.AsArray())
        {
            var targetId=p!["targetMapId"]!.ToString();
            if(!maps.TryGetValue(targetId,out var destination))throw new InvalidOperationException($"Transfer in {sourceId} targets missing map {targetId}.");
            var arrivalId=p["targetArrivalId"]?.ToString();
            if(arrivalId is not null)
            {
                var arrival=MapTransfers.Arrival(destination,arrivalId)??throw new InvalidOperationException($"Transfer in {sourceId} targets missing arrival {targetId}/{arrivalId}.");
                Floor(targetId,MapDocument.Number(arrival,"x"),MapDocument.Number(arrival,"y"));
            }
            else Floor(targetId,MapDocument.Number(p,"targetX"),MapDocument.Number(p,"targetY"));
        }
        void CheckPositions(JsonNode? node)
        {
            if(node is JsonObject obj)
            {
                if(obj["mapId"] is {} mapId && obj["x"] is not null && obj["y"] is not null)
                    Floor(mapId.ToString(),MapDocument.Number(obj,"x"),MapDocument.Number(obj,"y"));
                foreach(var pair in obj)CheckPositions(pair.Value);
            }
            else if(node is JsonArray array)foreach(var value in array)CheckPositions(value);
        }
        var root=Path.GetDirectoryName(ProjectPath)!;
        var content=manifest["content"]!;
        if(content["encounterGroups"] is {} groupsPath && content["encounterPlacements"] is {} placementsPath)
        {
            var groups=JsonNode.Parse(File.ReadAllText(Path.Combine(root,groupsPath.ToString())))!["groups"]!.AsArray().ToDictionary(g=>g!["id"]!.ToString());
            var placements=JsonNode.Parse(File.ReadAllText(Path.Combine(root,placementsPath.ToString())))!["placements"]!.AsArray();
            foreach(var placement in placements)
                if(groups.TryGetValue(placement!["groupId"]!.ToString(),out var group))
                    foreach(var member in group!["members"]!.AsArray())Floor(placement["mapId"]!.ToString(),MapDocument.Number(placement,"x")+MapDocument.Number(member!,"dx"),MapDocument.Number(placement,"y")+MapDocument.Number(member!,"dy"));
        }
        var ownFiles=documents.Values.Select(d=>d.FilePath).ToHashSet(AtomicFileStore.PathComparer);
        foreach(var file in ReferencedFiles())
            if(!ownFiles.Contains(file)&&!AtomicFileStore.PathComparer.Equals(file,IndexPath))CheckPositions(JsonNode.Parse(File.ReadAllText(file)));
    }
    public void Save()
    {
        Preflight();foreach(var (_,doc) in Maps)doc.Save();
        if(EnvironmentPath is not null&&EnvironmentSavedText()!=environmentSaved)
        {
            environmentFingerprint=environmentStore.Write(EnvironmentPath,System.Text.Encoding.UTF8.GetBytes(EnvironmentSavedText()),environmentFingerprint);
            environmentSaved=EnvironmentSavedText();
        }
        if(Index.ToJsonString()!=savedIndex){fingerprint=store.Write(IndexPath,Encoding.UTF8.GetBytes(MapDocument.Serialize(Index)),fingerprint);savedIndex=Index.ToJsonString();}
        // Multi-file commit is ordered, not atomic. Index last; each file has conflict protection and .bak recovery.
    }
}

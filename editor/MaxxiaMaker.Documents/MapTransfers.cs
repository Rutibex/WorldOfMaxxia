using System.Text.Json.Nodes;

namespace MaxxiaMaker.Documents;

/// <summary>Native MM18 authoring operations. All links use stable map/arrival IDs;
/// legacy target coordinates are retained as a compatibility cache.</summary>
public static class MapTransfers
{
    private static JsonArray Arrivals(JsonObject m)=>m["arrivals"]!.AsArray();
    private static JsonArray Portals(JsonObject m)=>m["objects"]!["portals"]!.AsArray();
    public static JsonObject? Arrival(JsonObject map,string id)=>Arrivals(map).Select(a=>a!.AsObject()).FirstOrDefault(a=>a["id"]!.ToString()==id);
    public static JsonObject? Portal(JsonObject map,string id)=>Portals(map).Select(a=>a!.AsObject()).FirstOrDefault(a=>a["id"]!.ToString()==id);
    public static void AssertFloor(JsonObject map,int x,int y)
    {
        if(x<0||y<0||x>=MapDocument.Number(map,"width")||y>=MapDocument.Number(map,"height")||map["geometry"]!["rows"]![y]!.ToString()[x]!='.')
            throw new InvalidOperationException($"An arrival or transfer needs a walkable floor at {x},{y}.");
    }
    public static string PutArrival(JsonObject map,string? id,string name,int x,int y,int facing)
    {
        if(string.IsNullOrWhiteSpace(name)||name.Length>100||facing is <0 or >3)throw new InvalidOperationException("Arrival needs a name (1–100 characters) and valid facing.");
        AssertFloor(map,x,y);
        id??="arrival_"+Guid.NewGuid().ToString("N");
        var arrival=Arrival(map,id);
        if(arrival is null)
        {
            if(Arrivals(map).Count>=64)throw new InvalidOperationException("At most 64 arrival points per map.");
            arrival=new JsonObject{["id"]=id};Arrivals(map).Add(arrival);
        }
        arrival["name"]=name.Trim();arrival["x"]=x;arrival["y"]=y;arrival["facing"]=facing;
        MapDocument.Validate(map);return id;
    }
    public static void RemoveArrival(JsonObject map,string id)
    {
        if(id=="arrival_start")throw new InvalidOperationException("arrival_start is required. Move it instead of deleting it.");
        var node=Arrival(map,id)??throw new InvalidOperationException("Unknown arrival.");
        Arrivals(map).Remove(node);MapDocument.Validate(map);
    }
    public static string PutPortal(JsonObject map,string? id,int x,int y,string targetMapId,JsonObject? targetArrival,string activation)
    {
        AssertFloor(map,x,y);
        if(activation!="step"&&activation!="interact")throw new InvalidOperationException("Choose step or interact activation.");
        if(Portals(map).Any(p=>p!["x"]!.GetValue<int>()==x&&p["y"]!.GetValue<int>()==y&&p["id"]!.ToString()!=id))
            throw new InvalidOperationException("This square already has a transfer. Edit that transfer instead.");
        if(targetArrival is null && (id is null||Portal(map,id)?["targetMapId"]?.ToString()!=targetMapId))
            throw new InvalidOperationException("A new transfer needs a named destination. Legacy coordinates can be retained only on the original map link.");
        id??="portal_"+Guid.NewGuid().ToString("N");
        var portal=Portal(map,id);
        if(portal is null)
        {
            if(Portals(map).Count>=12)throw new InvalidOperationException("At most 12 transfers per map.");
            portal=new JsonObject{["id"]=id};Portals(map).Add(portal);
        }
        portal["x"]=x;portal["y"]=y;portal["targetMapId"]=targetMapId;
        if(targetArrival is not null)
        {
            portal["targetArrivalId"]=targetArrival["id"]!.ToString();
            portal["targetX"]=targetArrival["x"]!.GetValue<int>();portal["targetY"]=targetArrival["y"]!.GetValue<int>();
            portal["targetFacing"]=targetArrival["facing"]!.GetValue<int>();
        }
        portal["activation"]=activation;
        MapDocument.Validate(map);return id;
    }
    public static void RemovePortal(JsonObject map,string id)
    {
        var portal=Portal(map,id)??throw new InvalidOperationException("Unknown transfer.");Portals(map).Remove(portal);MapDocument.Validate(map);
    }
    public static void SyncInbound(JsonObject map,string targetMapId,JsonObject arrival)
    {
        foreach(var portalNode in Portals(map))
        {
            var portal=portalNode!.AsObject();
            if(portal["targetMapId"]?.ToString()!=targetMapId||portal["targetArrivalId"]?.ToString()!=arrival["id"]?.ToString())continue;
            portal["targetX"]=arrival["x"]!.GetValue<int>();portal["targetY"]=arrival["y"]!.GetValue<int>();
            portal["targetFacing"]=arrival["facing"]!.GetValue<int>();
        }
    }
}

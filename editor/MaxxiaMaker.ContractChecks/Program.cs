using System.Text.Json;
using MaxxiaMaker.ProjectModel;

if (args.Length != 1) { Console.Error.WriteLine("Pass the manifest fixture directory."); return 2; }
var folder = Path.GetFullPath(args[0]);
using var index = JsonDocument.Parse(File.ReadAllText(Path.Combine(folder, "index.json")));
var results = new List<object>();
foreach (var fixture in index.RootElement.GetProperty("fixtures").EnumerateArray())
{
    var name = fixture.GetProperty("name").GetString()!;
    try
    {
        var model = ManifestReader.ReadFile(Path.Combine(folder, fixture.GetProperty("file").GetString()!));
        var roundTrip = ManifestReader.Serialize(model);
        _ = ManifestReader.Read(roundTrip);
        results.Add(new { name, valid = true, code = (string?)null, path = (string?)null, roundTrip });
    }
    catch (ManifestException error) { results.Add(new { name, valid = false, code = error.Code, path = error.Path }); }
}
var id = ManifestReader.CreateStableId("project");
if (id.Length != 40 || !id.StartsWith("project_")) throw new Exception("Generated ID is invalid.");
Console.WriteLine("MANIFEST_RESULTS=" + JsonSerializer.Serialize(new { engineVersion = ManifestContract.CurrentEngineVersion, schemaSha256 = ManifestContract.SchemaSha256, results }));
return 0;

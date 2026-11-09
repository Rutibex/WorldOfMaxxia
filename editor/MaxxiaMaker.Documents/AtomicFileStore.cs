using System.Security.Cryptography;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker.Documents;

public sealed class DocumentException(string code, string path, string message) : Exception($"{code}: {message}")
{
    public string Code { get; } = code;
    public string FilePath { get; } = path;
}
public sealed record DiskSnapshot(byte[] Bytes, string Fingerprint);
public enum SaveStage { AfterTempFlushed, BeforeCommit }
public interface IDocumentStore
{
    DiskSnapshot Read(string path);
    void CheckUnchanged(string path, string fingerprint);
    string Write(string path, byte[] bytes, string? expectedFingerprint);
}

/// <summary>Bounded reads, optimistic external-change checks and per-file atomic commits.</summary>
public sealed class AtomicFileStore(Action<SaveStage>? checkpoint = null, int maxBytes = ManifestReader.MaxBytes) : IDocumentStore
{
    public static StringComparer PathComparer { get; } = OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
    public static string Normalize(string path) => Path.GetFullPath(path);
    public static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));

    public DiskSnapshot Read(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length > maxBytes + 3) throw new DocumentException("E_SIZE", path, "Document exceeds the manifest byte limit.");
        using var buffer = new MemoryStream();
        var chunk = new byte[4096]; int count;
        while ((count = stream.Read(chunk)) > 0)
        {
            if (buffer.Length + count > maxBytes + 3) throw new DocumentException("E_SIZE", path, "Document exceeds the manifest byte limit.");
            buffer.Write(chunk, 0, count);
        }
        var bytes = buffer.ToArray(); return new DiskSnapshot(bytes, Hash(bytes));
    }

    public void CheckUnchanged(string path, string fingerprint)
    {
        try
        {
            if (Read(path).Fingerprint == fingerprint) return;
        }
        catch (FileNotFoundException) { }
        catch (DocumentException error) when (error.Code == "E_SIZE") { }
        throw new DocumentException("E_CONFLICT", path, "The file changed or was deleted outside the editor. Reload it or save a separate copy; the original was not overwritten.");
    }

    public string Write(string path, byte[] bytes, string? expectedFingerprint)
    {
        path = Normalize(path);
        var folder = Path.GetDirectoryName(path)!;
        if (!Directory.Exists(folder)) throw new DocumentException("E_LOCATION", path, "Choose an existing destination folder.");
        if (new FileInfo(path).LinkTarget is not null) throw new DocumentException("E_LINK", path, "Saving through a symbolic link is not supported. Open the actual file.");
        // Cooperative writers share this zero-byte lock sidecar. A crashed process releases the handle.
        using var gate = new FileStream(path + ".save-lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        void Preflight()
        {
            if (expectedFingerprint is null)
            {
                if (File.Exists(path)) throw new DocumentException("E_TARGET_EXISTS", path, "Destination already exists. Choose a new filename.");
            }
            else CheckUnchanged(path, expectedFingerprint);
        }
        Preflight();
        var temp = Path.Combine(folder, "." + Path.GetFileName(path) + "." + Guid.NewGuid().ToString("N") + ".tmp");
        try
        {
            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            {
                stream.Write(bytes); stream.Flush(flushToDisk: true);
            }
            checkpoint?.Invoke(SaveStage.AfterTempFlushed);
            checkpoint?.Invoke(SaveStage.BeforeCommit);
            Preflight(); // Includes changes made while staging the replacement.
            if (expectedFingerprint is null) File.Move(temp, path, overwrite: false);
            else File.Replace(temp, path, path + ".bak", ignoreMetadataErrors: false);
            return Hash(bytes);
        }
        finally
        {
            try { if (File.Exists(temp)) File.Delete(temp); }
            catch (IOException) { /* A leftover staging file never becomes the project document. */ }
            catch (UnauthorizedAccessException) { }
        }
    }
}

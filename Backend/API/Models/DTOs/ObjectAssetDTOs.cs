namespace Pickleball.Community.Models.DTOs;

// ObjectType DTOs
public class ObjectTypeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? TableName { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public int AssetTypeCount { get; set; }
}

public class CreateObjectTypeDto
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? TableName { get; set; }
    public int SortOrder { get; set; } = 0;
}

public class UpdateObjectTypeDto
{
    public string? Name { get; set; }
    public string? DisplayName { get; set; }
    public string? TableName { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
}

// ObjectAssetType DTOs
public class ObjectAssetTypeDto
{
    public int Id { get; set; }
    public int ObjectTypeId { get; set; }
    public string? ObjectTypeName { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ColorClass { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public bool IsSystem { get; set; }
}

public class CreateObjectAssetTypeDto
{
    public int ObjectTypeId { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ColorClass { get; set; }
    public int SortOrder { get; set; } = 0;
}

public class UpdateObjectAssetTypeDto
{
    public string? TypeName { get; set; }
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ColorClass { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
}

// ObjectAsset DTOs
public class ObjectAssetDto
{
    public int Id { get; set; }
    public int ObjectTypeId { get; set; }
    public string? ObjectTypeName { get; set; }
    public int ObjectAssetTypeId { get; set; }
    public string? AssetTypeName { get; set; }
    public string? AssetTypeDisplayName { get; set; }
    public string? AssetTypeIconName { get; set; }
    public string? AssetTypeColorClass { get; set; }
    public int ObjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? FileType { get; set; }
    public int? FileSize { get; set; }
    public bool IsPublic { get; set; }
    public int SortOrder { get; set; }
    public int UploadedByUserId { get; set; }
    public string? UploadedByUserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateObjectAssetDto
{
    public int ObjectAssetTypeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? FileType { get; set; }
    public int? FileSize { get; set; }
    public bool IsPublic { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}

public class UpdateObjectAssetDto
{
    public int? ObjectAssetTypeId { get; set; }
    public string? Title { get; set; }
    public bool? IsPublic { get; set; }
    public int? SortOrder { get; set; }
}

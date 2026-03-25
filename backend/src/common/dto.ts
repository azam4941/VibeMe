import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsEnum, Min, Max, MaxLength, MinLength, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ───── Auth DTOs ─────

export class SendOtpDto {
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phoneNumber: string;
}

export class VerifyOtpDto {
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phoneNumber: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;
}

export class VerifyFirebaseDto {
  @IsString()
  idToken: string;
}

// ───── User / Profile DTOs ─────

export class TimeSlotDto {
  @IsString()
  @IsEnum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  day: string;

  @IsString()
  startTime: string; // "09:00"

  @IsString()
  endTime: string; // "17:00"
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  findInterests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  professionalInterests?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @IsOptional()
  @IsBoolean()
  isPhotoLocked?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(['online', 'busy', 'offline'])
  currentStatus?: string;

  @IsOptional()
  @IsBoolean()
  rentMode?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  pricePerMinute?: number;
}

export class SetPriceDto {
  @IsNumber()
  @Min(0)
  @Max(100000)
  pricePerMinute: number;
}

export class SetAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  @ArrayMaxSize(21) // 3 slots per day max
  availability: TimeSlotDto[];
}

export class ToggleRentModeDto {
  @IsBoolean()
  rentMode: boolean;
}

// ───── Discovery DTOs ─────

export class DiscoverQueryDto {
  @IsOptional()
  @IsString()
  interests?: string; // comma-separated

  @IsOptional()
  @IsString()
  minPrice?: string;

  @IsOptional()
  @IsString()
  maxPrice?: string;

  @IsOptional()
  @IsString()
  minRating?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['online', 'busy', 'offline', ''])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string; // name search

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['rating', 'price_asc', 'price_desc', 'sessions', ''])
  sortBy?: string;
}

// ───── Session / Booking DTOs ─────

export class CreateSessionDto {
  @IsString()
  renterId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

// ───── Chat DTOs ─────

export class CreateRoomDto {
  @IsString()
  userId: string;
}

export class SendMessageDto {
  @IsString()
  roomId: string;

  @IsString()
  receiverId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

// ───── Review DTOs ─────

export class CreateReviewDto {
  @IsString()
  targetUserId: string;

  @IsString()
  sessionId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

// ───── Report / Safety DTOs ─────

export class ReportUserDto {
  @IsString()
  reportedUserId: string;

  @IsString()
  @IsEnum(['harassment', 'spam', 'fake_profile', 'inappropriate_content', 'scam', 'other'])
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class BlockUserDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class AdminUpdateReportDto {
  @IsString()
  @IsEnum(['pending', 'reviewed', 'resolved', 'dismissed'])
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

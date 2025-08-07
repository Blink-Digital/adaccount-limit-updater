# Facebook Ads Manager - Full Stack Application

## Overview

This is a full-stack web application built for managing Facebook ad accounts, specifically for viewing and updating spending caps. The application features a React frontend with shadcn/ui components and an Express.js backend that interfaces with the Facebook Graph API.

**Current Status**: Fully functional interface with proper spend cap conversion handling. Users can fetch account details and update spend caps with correct dollar-to-API value conversion.

## User Preferences

- **Communication style**: Simple, everyday language
- **Default Ad Account**: act_1003491274360037 (configured as default in forms)
- **Currency handling**: Fixed conversion logic - Facebook API expects dollar values, not cents

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend, backend, and shared components:

- **Frontend**: React with TypeScript using Vite as the build tool
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (configured but not yet fully implemented)
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Form Handling**: React Hook Form with Zod validation

## Key Components

### Frontend Architecture
- **Component Library**: Comprehensive shadcn/ui components with "new-york" style
- **Routing**: Wouter for client-side routing
- **Build System**: Vite with custom configuration for Replit environment
- **State Management**: TanStack Query for API calls and caching
- **Form Validation**: React Hook Form integrated with Zod schemas

### Backend Architecture
- **Server Framework**: Express.js with TypeScript
- **API Structure**: RESTful endpoints for Facebook Graph API integration
- **Database Integration**: Drizzle ORM configured for PostgreSQL
- **Development**: Hot reload with tsx for development
- **Production Build**: esbuild for server bundling

### Data Storage
- **Database**: PostgreSQL (via Neon Database)
- **ORM**: Drizzle with schema definitions in shared directory
- **In-Memory Storage**: Temporary storage implementation for development
- **Session Management**: Configured for connect-pg-simple (session storage)

### Authentication & External APIs
- **Facebook Integration**: Direct API calls to Facebook Graph API
- **Token Management**: Access tokens handled client-side (security consideration for production)
- **API Validation**: Zod schemas for request/response validation

## Data Flow

1. **User Input**: Forms capture Facebook access tokens and ad account IDs
2. **Client Validation**: Zod schemas validate input before API calls
3. **API Requests**: React Query manages API calls to Express backend
4. **External API**: Backend proxies requests to Facebook Graph API
5. **Response Handling**: Structured API responses with success/error states
6. **UI Updates**: Real-time feedback via toast notifications and loading states

## External Dependencies

### Core Technologies
- **React 18**: Frontend framework with hooks and modern patterns
- **Express.js**: Backend server framework
- **TypeScript**: Type safety across the entire stack
- **Drizzle ORM**: Database operations and migrations
- **TanStack Query**: Server state management and caching

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Pre-built accessible components
- **Radix UI**: Unstyled component primitives
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundling

### External Services
- **Facebook Graph API**: Ad account management
- **Neon Database**: PostgreSQL hosting
- **Replit**: Development environment with custom plugins

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with hot reload
- **Backend**: tsx with nodemon-like behavior
- **Database**: Drizzle migrations with push command
- **Environment**: Replit-optimized with custom Vite plugins

### Production Build
- **Frontend**: Vite build to `dist/public`
- **Backend**: esbuild bundle to `dist/index.js`
- **Database**: Production PostgreSQL via DATABASE_URL
- **Deployment**: Single command build script

### Configuration Management
- **Environment Variables**: DATABASE_URL for database connection
- **Path Aliases**: Organized imports with @ prefixes
- **TypeScript**: Strict configuration with path mapping
- **Build Optimization**: Separate client/server build processes

### Security Considerations
- **API Validation**: All inputs validated with Zod schemas
- **Error Handling**: Structured error responses
- **CORS**: Configured for cross-origin requests
- **Token Security**: Client-side token handling (needs server-side improvement)

## Recent Changes

- **August 7, 2025**: **CONFIRMED**: Facebook Graph API does NOT support spend_cap filtering - server-side filtering is the only viable approach
- **August 7, 2025**: Optimized API calls with Facebook-level filtering for active accounts (`account_status=1`) reducing payload size significantly
- **August 7, 2025**: Implemented robust server-side filtering for Reset Caps: active accounts with spend_cap > 1 unit and zero spend last month
- **August 7, 2025**: Added multiple layers of filtering (string comparison, numeric parsing, client-side backup) to ensure accounts with exactly ₹1/$1/€1 spend caps are excluded
- **August 7, 2025**: Updated Facebook App ID from `426361686419846` to `1678172042635501` in Facebook SDK configuration
- **August 7, 2025**: Enhanced Business Manager accounts API to include spending insights data for proper inactive account filtering

## API Filtering Capabilities (Tested August 7, 2025)

**✅ Supported by Facebook Graph API:**
- `account_status` filtering (implemented)
- Date-based filtering  
- Campaign/ad-level filtering

**❌ NOT Supported by Facebook Graph API:**
- `spend_cap` filtering (Error: "#100 Filtering field 'spend_cap' with operation 'greater_than' is not supported")
- Custom spend limit filtering

**Current Architecture Decision**: Use Facebook API filtering where possible (`account_status=1`), then apply server-side filtering for `spend_cap` constraints. This is the optimal approach within Facebook's API limitations.

The application is designed for easy development in Replit while maintaining production-ready architecture patterns. The modular structure allows for easy extension of Facebook API features and database operations.
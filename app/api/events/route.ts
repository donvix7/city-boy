import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { verifyToken } from "@/lib/auth"

// GET all events
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const featured = searchParams.get("featured")
    const limit = searchParams.get("limit") || "10"

    let query = `
      SELECT * FROM events 
      ORDER BY event_date DESC 
      LIMIT $1
    `

    const params = [Number.parseInt(limit)]

    if (featured === "true") {
      query = `
        SELECT * FROM events 
        WHERE is_featured = true 
        ORDER BY event_date DESC 
        LIMIT $1
      `
    }

    const result = await sql.query(query, params)

    return NextResponse.json({
      success: true,
      events: result.rows,
    })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch events", error: String(error) },
      { status: 500 },
    )
  }
}

// POST new event (admin only)
export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.headers.get("authorization")?.split(" ")[1]
    const user = await verifyToken(token)

    if (!user || user.role !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { title, description, location, eventDate, imageUrl, isFeatured } = await request.json()

    // Validate input
    if (!title || !eventDate) {
      return NextResponse.json({ success: false, message: "Title and event date are required" }, { status: 400 })
    }

    // Create event
    const result = await sql`
      INSERT INTO events (
        title, 
        description, 
        location, 
        event_date, 
        image_url, 
        is_featured
      ) VALUES (
        ${title}, 
        ${description || ""}, 
        ${location || ""}, 
        ${new Date(eventDate)}, 
        ${imageUrl || ""}, 
        ${isFeatured || false}
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      event: result.rows[0],
    })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json(
      { success: false, message: "Failed to create event", error: String(error) },
      { status: 500 },
    )
  }
}


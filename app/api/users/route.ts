import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { isAdmin } from "@/lib/auth"
import { hashPassword } from "@/lib/passwordUtils"

// Get all users (admin only)
export async function GET(req: NextRequest) {
  try {
    // Check if user is admin
    const adminCheck = await isAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const offset = (page - 1) * limit
    const state = searchParams.get("state")
    const lga = searchParams.get("lga")
    const hasPVC = searchParams.get("hasPVC")

    // Build query with filters
    let queryText = "SELECT id, full_name, email, phone, state, lga, ward, has_pvc, role, created_at FROM users"
    const queryParams: any[] = []
    const conditions = []
    let paramIndex = 1

    if (state) {
      conditions.push(`state = $${paramIndex}`)
      queryParams.push(state)
      paramIndex++
    }

    if (lga) {
      conditions.push(`lga = $${paramIndex}`)
      queryParams.push(lga)
      paramIndex++
    }

    if (hasPVC !== null && hasPVC !== undefined) {
      conditions.push(`has_pvc = $${paramIndex}`)
      queryParams.push(hasPVC === "true")
      paramIndex++
    }

    if (conditions.length > 0) {
      queryText += " WHERE " + conditions.join(" AND ")
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await query(queryText, queryParams)

    // Get total count for pagination
    let countQueryText = "SELECT COUNT(*) FROM users"
    if (conditions.length > 0) {
      countQueryText += " WHERE " + conditions.join(" AND ")
    }

    const countResult = await query(countQueryText, queryParams.slice(0, paramIndex - 1))
    const totalCount = Number.parseInt(countResult.rows[0].count)

    return NextResponse.json({
      users: result.rows,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// Create a new user (admin only)
export async function POST(req: NextRequest) {
  try {
    // Check if user is admin
    const adminCheck = await isAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fullName, email, phone, password, state, lga, ward, hasPVC, role } = await req.json()

    // Validate required fields
    if (!fullName || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await query("SELECT * FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Insert new user
    const result = await query(
      `INSERT INTO users (full_name, email, phone, password, state, lga, ward, has_pvc, role) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, full_name, email, phone, state, lga, ward, has_pvc, role, created_at`,
      [fullName, email, phone, hashedPassword, state, lga, ward, hasPVC === true, role || "member"],
    )

    return NextResponse.json({
      message: "User created successfully",
      user: result.rows[0],
    })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}


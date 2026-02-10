import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);


async function appendToSheet(email: string) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authedSheets = google.sheets({ version: "v4", auth });

  await authedSheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1!A:B",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[email, new Date().toISOString()]],
    },
  });
}

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { error } = await supabase.from("waitlist").insert({ email });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "Already on the list" });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  // Append to Google Sheet
  try {
    await appendToSheet(email);
  } catch (err) {
    console.error("Google Sheets error:", err);
  }

  return NextResponse.json({ message: "Added to waitlist" });
}

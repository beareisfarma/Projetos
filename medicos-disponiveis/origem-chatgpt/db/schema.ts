import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const visitedDoctors=sqliteTable("visited_doctors",{
  userId:text("user_id").notNull(),
  doctorName:text("doctor_name").notNull(),
},table=>[primaryKey({columns:[table.userId,table.doctorName]})]);

export const itineraryEntries=sqliteTable("itinerary_entries",{
  userId:text("user_id").notNull(),
  doctorName:text("doctor_name").notNull(),
  day:text("day").notNull(),
  shift:text("shift").notNull(),
  status:text("status",{enum:["pending","visited","not_visited"]}).notNull().default("pending"),
},table=>[primaryKey({columns:[table.userId,table.doctorName,table.day,table.shift]})]);

import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { itineraryEntries, visitedDoctors } from "../../../db/schema";

function userId(request:Request){
  const stableId=request.headers.get("oai-authenticated-user-id");
  if(stableId)return stableId;
  return request.headers.get("oai-authenticated-user-email")?"private-site-owner":null;
}

export async function GET(request:Request){
  const id=userId(request);if(!id)return Response.json({error:"Acesso não identificado."},{status:401});
  try{const rows=await getDb().select({name:visitedDoctors.doctorName}).from(visitedDoctors).where(eq(visitedDoctors.userId,id));return Response.json({visited:rows.map(row=>row.name)});}
  catch{return Response.json({error:"Não foi possível carregar as visitas."},{status:500});}
}

export async function POST(request:Request){
  const id=userId(request);if(!id)return Response.json({error:"Acesso não identificado."},{status:401});
  try{const payload=await request.json() as {name?:string;visited?:boolean};const name=payload.name?.trim();if(!name||typeof payload.visited!=="boolean")return Response.json({error:"Dados inválidos."},{status:400});const db=getDb();if(payload.visited){await db.insert(visitedDoctors).values({userId:id,doctorName:name}).onConflictDoNothing();await db.update(itineraryEntries).set({status:"visited"}).where(and(eq(itineraryEntries.userId,id),eq(itineraryEntries.doctorName,name)));}else{await db.delete(visitedDoctors).where(and(eq(visitedDoctors.userId,id),eq(visitedDoctors.doctorName,name)));await db.update(itineraryEntries).set({status:"pending"}).where(and(eq(itineraryEntries.userId,id),eq(itineraryEntries.doctorName,name)));}return Response.json({ok:true});}
  catch{return Response.json({error:"Não foi possível salvar a visita."},{status:500});}
}

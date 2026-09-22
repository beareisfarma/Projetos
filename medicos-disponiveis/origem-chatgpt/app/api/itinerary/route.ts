import { and,eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { itineraryEntries,visitedDoctors } from "../../../db/schema";
type Status="pending"|"visited"|"not_visited";
function userId(request:Request){return request.headers.get("oai-authenticated-user-id")||(request.headers.get("oai-authenticated-user-email")?"private-site-owner":null);}
export async function GET(request:Request){const id=userId(request);if(!id)return Response.json({error:"Acesso não identificado."},{status:401});try{const entries=await getDb().select().from(itineraryEntries).where(eq(itineraryEntries.userId,id));return Response.json({entries});}catch{return Response.json({error:"Não foi possível carregar os roteiros."},{status:500});}}
export async function POST(request:Request){
 const id=userId(request);if(!id)return Response.json({error:"Acesso não identificado."},{status:401});
 try{const payload=await request.json() as {action?:"add"|"status"|"remove";names?:string[];name?:string;day?:string;shift?:string;status?:Status};if(!payload.day||!payload.shift)return Response.json({error:"Dia e turno são obrigatórios."},{status:400});const db=getDb();
 if(payload.action==="add"){const names=(payload.names||[]).map(n=>n.trim()).filter(Boolean);if(!names.length)return Response.json({error:"Selecione ao menos um médico."},{status:400});await db.insert(itineraryEntries).values(names.map(doctorName=>({userId:id,doctorName,day:payload.day!,shift:payload.shift!,status:"pending" as const}))).onConflictDoNothing();}
 else if(payload.action==="status"){if(!payload.name||!payload.status||!["pending","visited","not_visited"].includes(payload.status))return Response.json({error:"Dados inválidos."},{status:400});await db.update(itineraryEntries).set({status:payload.status}).where(and(eq(itineraryEntries.userId,id),eq(itineraryEntries.doctorName,payload.name),eq(itineraryEntries.day,payload.day),eq(itineraryEntries.shift,payload.shift)));if(payload.status==="visited")await db.insert(visitedDoctors).values({userId:id,doctorName:payload.name}).onConflictDoNothing();else await db.delete(visitedDoctors).where(and(eq(visitedDoctors.userId,id),eq(visitedDoctors.doctorName,payload.name)));}
 else if(payload.action==="remove"){if(!payload.name)return Response.json({error:"Médico inválido."},{status:400});await db.delete(itineraryEntries).where(and(eq(itineraryEntries.userId,id),eq(itineraryEntries.doctorName,payload.name),eq(itineraryEntries.day,payload.day),eq(itineraryEntries.shift,payload.shift)));}
 else return Response.json({error:"Ação inválida."},{status:400});return Response.json({ok:true});
 }catch{return Response.json({error:"Não foi possível salvar o roteiro."},{status:500});}
}

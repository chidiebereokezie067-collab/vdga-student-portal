import { getStore } from "@netlify/blobs";

const STORE = "vdga-portal";
const KEY = "students.json";
const PASSWORD_KEY = "admin-password.txt";
const DEFAULT_PASSWORD = "admin123";
const INITIAL_STUDENTS = [{"name": "FRANCISCA CHUKWU", "reg": "VDGA663DC", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 75}]}, {"name": "APOLLOS FLORENCE", "reg": "VGDA697AF", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 95}]}, {"name": "VICTORIA JOSEPH", "reg": "VGDA357JV", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 75}]}, {"name": "JOHN DESTINY", "reg": "VGDA690JD", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 80}]}, {"name": "GIFT NNADOZIE", "reg": "VGDA395NG", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 60}]}, {"name": "ZION UKONU", "reg": "VGDA092ZE", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 70}]}, {"name": "FAITHFUL CELESTINE", "reg": "VGDA784CF", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 90}]}, {"name": "HAPPINESS UDOCHUKWU", "reg": "VGDA380HU", "department": "GRAPHIC CREATIVE", "results": [{"course": "GRAPHIC FOUNDATION", "code": "GRF 172", "score": 90}]}];

async function readStudents() {
  const store = getStore(STORE);
  const data = await store.get(KEY, { type: "json" });
  if (Array.isArray(data)) return data;
  await store.setJSON(KEY, INITIAL_STUDENTS);
  return INITIAL_STUDENTS;
}
async function writeStudents(students) {
  await getStore(STORE).setJSON(KEY, students);
}
async function getPassword() {
  const p = await getStore(STORE).get(PASSWORD_KEY, { type: "text" });
  return p || DEFAULT_PASSWORD;
}
function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers: {"content-type":"application/json","cache-control":"no-store"}
  });
}
function grade(score) {
  score=Number(score);
  if(score>=70)return {g:"A",p:5}; if(score>=60)return {g:"B",p:4};
  if(score>=50)return {g:"C",p:3}; if(score>=45)return {g:"D",p:2};
  if(score>=40)return {g:"E",p:1}; return {g:"F",p:0};
}
function auth(req, password) {
  return req.headers.get("x-admin-password") === password;
}

export default async (req) => {
  try {
    const method=req.method;
    const url=new URL(req.url);
    const action=url.searchParams.get("action") || "";
    const password=await getPassword();

    if(method==="POST" && action==="login") {
      const body=await req.json();
      return body.password===password ? json({ok:true}) : json({error:"Incorrect password"},401);
    }

    if(method==="GET") {
      const students=await readStudents();
      const reg=(url.searchParams.get("reg")||"").trim().toUpperCase();
      if(reg) {
        const s=students.find(x=>String(x.reg).toUpperCase()===reg);
        return s ? json({student:s}) : json({error:"Registration number not found"},404);
      }
      return json({students});
    }

    if(!auth(req,password)) return json({error:"Unauthorized"},401);

    if(method==="POST") {
      const body=await req.json();
      const students=await readStudents();

      if(action==="student") {
        const name=String(body.name||"").trim().toUpperCase();
        const reg=String(body.reg||"").trim().toUpperCase();
        const department=String(body.department||"GRAPHIC CREATIVE").trim().toUpperCase();
        if(!name||!reg) return json({error:"Name and registration number are required"},400);
        if(!/^[A-Z0-9-]{3,30}$/.test(reg)) return json({error:"Invalid registration number"},400);
        if(students.some(s=>String(s.reg).toUpperCase()===reg)) return json({error:"Registration number already exists"},409);
        students.push({name,reg,department,results:[]});
        await writeStudents(students);
        return json({ok:true,students});
      }

      if(action==="result") {
        const i=Number(body.studentIndex);
        const score=Number(body.score);
        if(!students[i]) return json({error:"Student not found"},404);
        if(!body.course||!body.code||!Number.isFinite(score)||score<0||score>100) return json({error:"Invalid result"},400);
        students[i].results.push({course:String(body.course).trim().toUpperCase(),code:String(body.code).trim().toUpperCase(),score});
        await writeStudents(students);
        return json({ok:true,students});
      }

      if(action==="delete-student") {
        const i=Number(body.index); if(!students[i]) return json({error:"Student not found"},404);
        students.splice(i,1); await writeStudents(students); return json({ok:true,students});
      }

      if(action==="delete-result") {
        const i=Number(body.studentIndex),j=Number(body.resultIndex);
        if(!students[i] || !students[i].results[j]) return json({error:"Result not found"},404);
        students[i].results.splice(j,1); await writeStudents(students); return json({ok:true,students});
      }

      if(action==="import") {
        if(!Array.isArray(body.students)) return json({error:"Invalid backup"},400);
        await writeStudents(body.students); return json({ok:true,students:body.students});
      }

      if(action==="change-password") {
        if(body.oldPassword!==password || String(body.newPassword||"").length<6 || body.newPassword!==body.confirmPassword)
          return json({error:"Password change failed"},400);
        await getStore(STORE).set(PASSWORD_KEY, String(body.newPassword));
        return json({ok:true});
      }
    }
    return json({error:"Not found"},404);
  } catch(e) {
    return json({error:"Server error: "+e.message},500);
  }
};

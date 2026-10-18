import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const supabaseUrl = 'https://qguwswypxwbbdbujmffy.supabase.co';
const supabaseKey = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.',
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFn',
  'dXdzd3lweHdiYmRidWptZmZ5Iiwicm9sZSI6',
  'ImFub24iLCJpYXQiOjE3OTIzMDUxNzMsImV4',
  'cCI6MjEwNzg4MTE3M30.tIVrY8ow_5R23XZR',
  '8zeQUFuGOBVjt6LLYa8QwAfDoxY',
].join('');

const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [rooms, setRooms] = useState([]);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  const fetchRooms = () => {
    supabase
      .from('Room')
      .select('*')
      .order('Room_name', { ascending: true })
      .then(({ data }) => setRooms(data || []));
  };

  useEffect(() => {
    fetchRooms();
    const channel = supabase
      .channel('realtime-rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Room' },
        fetchRooms
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const updateQueue = async (roomName, newCount) => {
    const count = Math.max(0, newCount);
    await supabase
      .from('Room')
      .update({ Queue_count: count })
      .eq('Room_name', roomName);
    fetchRooms();
  };

  // สร้างโลก 3 มิติด้วย Three.js
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.innerHTML = '';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f9');

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / 420,
      0.1,
      1000
    );
    camera.position.set(10, 10, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, 420);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // ตัวควบคุมให้ใช้เมาส์คลิกหมุนและซูมได้ 360 องศา
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // จัดไฟส่องสว่างในฉาก
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(8, 15, 10);
    scene.add(dirLight);

    // พื้นตารางโรงพยาบาล
    scene.add(new THREE.GridHelper(14, 14, 0x94a3b8, 0xe2e8f0));

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    sceneRef.current = dynamicGroup;

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      // สั่งให้ตัวคนไข้กระโดดดึ๋งๆ มีชีวิตชีวา
      dynamicGroup.children.forEach((roomBox) => {
        roomBox.children.forEach((item) => {
          if (item.userData.isPatient) {
            item.position.y =
              0.5 +
              Math.abs(Math.sin(Date.now() * 0.005 + item.userData.offset)) *
                0.25;
          }
        });
      });
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => cancelAnimationFrame(frameId);
  }, []);

  // อัปเดตห้องและปั้นหุ่นคนไข้ 3D ตามจำนวนคิวสด
  useEffect(() => {
    const group = sceneRef.current;
    if (!group) return;
    while (group.children.length > 0) group.remove(group.children[0]);

    const colors = [0xec4899, 0x10b981, 0xf59e0b, 0x6366f1];

    rooms.forEach((r, i) => {
      const roomGroup = new THREE.Group();
      const row = Math.floor(i / 2);
      const col = i % 2;
      roomGroup.position.set(col * 5 - 2.5, 0, row * 5 - 2);

      const count = Number(r.Queue_count) || 0;
      const isCrowded = count >= 5;
      const roomColor = isCrowded ? 0xef4444 : colors[i % colors.length];

      // ฐานพื้นห้อง 3D
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.3, 3.8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      base.position.y = 0.15;
      roomGroup.add(base);

      // กำแพงห้อง 3D (เปลี่ยนเป็นสีแดงทันทีถ้าคิวตั้งแต่ 5 ขึ้นไป)
      const wallMat = new THREE.MeshStandardMaterial({ color: roomColor });
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 1.3, 0.2),
        wallMat
      );
      backWall.position.set(0, 0.8, -1.8);
      roomGroup.add(backWall);

      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.3, 3.8),
        wallMat
      );
      leftWall.position.set(-1.8, 0.8, 0);
      roomGroup.add(leftWall);

      // โต๊ะตรวจและหุ่นคุณหมอ (สีฟ้า)
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.5, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
      );
      desk.position.set(0.8, 0.5, -1);
      roomGroup.add(desk);

      const doc = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.4, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9 })
      );
      doc.position.set(0.8, 0.8, -1.5);
      roomGroup.add(doc);

      // เสกหุ่นคนไข้สีส้มเข้าห้องตามจำนวนคิวสด!
      const maxDots = Math.min(count, 12);
      for (let d = 0; d < maxDots; d++) {
        const patient = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.2, 0.3, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xf97316 })
        );
        const px = (d % 3) * 0.85 - 0.85;
        const pz = Math.floor(d / 3) * 0.85 - 0.1;
        patient.position.set(px, 0.5, pz);
        patient.userData = { isPatient: true, offset: d };
        roomGroup.add(patient);
      }

      group.add(roomGroup);
    });
  }, [rooms]);

  const hexColors = ['#ec4899', '#10b981', '#f59e0b', '#6366f1'];

  return (
    <div
      style={{
        padding: '16px',
        fontFamily: 'sans-serif',
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
      <h2 style={{ margin: 0, color: '#0f172a' }}>
        🏥 Real 3D Digital Twin (หมุนดูได้ 360°)
      </h2>
      <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 12px 0' }}>
        🖱️ <b>ใช้เมาส์คลิกค้างแล้วลาก</b> เพื่อหมุนดูตึก 3 มิติ /
        เลื่อนลูกกลิ้งเพื่อซูมเข้า-ออกได้เลย!
      </p>

      {/* ปุ่มกดจำลองคิวสด */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        {rooms.map((r, i) => {
          const count = Number(r.Queue_count) || 0;
          const isCrowded = count >= 5;
          return (
            <div
              key={i}
              style={{
                background: isCrowded ? '#fef2f2' : 'white',
                padding: '6px 12px',
                borderRadius: '10px',
                border:
                  '2px solid ' +
                  (isCrowded ? '#ef4444' : hexColors[i % hexColors.length]),
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                📍 {r.Room_name} {isCrowded ? '🔥' : ''}:
              </span>
              <button
                onClick={() => updateQueue(r.Room_name, count - 1)}
                style={{ cursor: 'pointer', padding: '2px 8px' }}
              >
                -
              </button>
              <span
                style={{
                  fontWeight: 'bold',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {count}
              </span>
              <button
                onClick={() => updateQueue(r.Room_name, count + 1)}
                style={{
                  cursor: 'pointer',
                  padding: '2px 8px',
                  background: hexColors[i % hexColors.length],
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      {/* เวทีแสดงผล 3D ของจริง */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '420px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '2px solid #cbd5e1',
          cursor: 'grab',
          background: '#f1f5f9',
        }}
      />
    </div>
  );
}

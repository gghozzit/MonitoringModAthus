import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Download } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Inisialisasi klien Supabase - ganti dengan kredensial Anda sendiri
const supabase = createClient('https://qqwbholpjtwptvqwfyhy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd2Job2xwanR3cHR2cXdmeWh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzEwNjQ1NiwiZXhwIjoyMDM4NjgyNDU2fQ.sHK3cuZL1_rq3bOpFhu5m-wVLHDKSjYSZRKNKqhSHGA');

const App = () => {
  const YKCoordinates = [-6.9994262, 110.4154566];
  const [filteredData, setFilteredData] = useState([]);
  const [airQualityData, setAirQualityData] = useState([]);
  const [historicalData, setHistoricalData] = useState({
    labels: [],
    datasets: [
      { label: 'x', data: [], borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgb(54, 162, 235)', tension: 0.4, fill: false },
      { label: 'y', data: [], borderColor: 'rgb(153, 102, 255)', backgroundColor: 'rgb(153, 102, 255)', tension: 0.4, fill: false },
      { label: 'press', data: [], borderColor: 'rgb(255, 205, 86)', backgroundColor: 'rgb(255, 205, 86)', tension: 0.4, fill: false },
      { label: 'batt', data: [], borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgb(75, 192, 192)', tension: 0.4, fill: false }
    ]
  });
  const [deviceNames, setDeviceNames] = useState([]); 
  const [selectedDevice, setSelectedDevice] = useState('all'); 
  const markerRef = useRef({}); 
  const [sortBy, setSortBy] = useState(null); 
  const [sortOrder, setSortOrder] = useState('asc'); 
  const [searchQuery, setSearchQuery] = useState(''); 

  useEffect(() => {
    fetchData();
    const subscription = supabase
      .channel('ModAthus')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ModAthus' }, fetchData)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (airQualityData.length > 0) {
      // Update device names whenever airQualityData berubah
      const names = [...new Set(airQualityData.map(item => item.device_name))];
      setDeviceNames(names);
      updateHistoricalData(airQualityData);
    }
  }, [airQualityData]);

  useEffect(() => {
    if (airQualityData.length > 0) {
      updateHistoricalData(airQualityData);
    }
  }, [selectedDevice]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('ModAthus')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
    } else {
      setAirQualityData(data);
      // Ekstrak nama perangkat unik dari data
      const names = [...new Set(data.map(item => item.device_name))];
      setDeviceNames(names);
    }
  };

  useEffect(() => {
    const filtered = airQualityData.filter(row => 
      row.x.toString().includes(searchQuery) ||
      row.y.toString().includes(searchQuery) ||
      row.press.toString().includes(searchQuery) ||
      row.batt.toString().includes(searchQuery)
    );
    setFilteredData(filtered);
  }, [searchQuery, airQualityData]);

  const handleSort = (column) => {
    const order = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortOrder(order);
    const sortedData = [...filteredData].sort((a, b) => {
      if (order === 'asc') return a[column] > b[column] ? 1 : -1;
      return a[column] < b[column] ? 1 : -1;
    });
    setFilteredData(sortedData);
  };

  const updateHistoricalData = (data) => {
    let filteredData = data;
    if (selectedDevice !== 'all') {
      filteredData = data.filter(item => item.device_name === selectedDevice);
    }
    
    const latestData = filteredData.slice(0, 6);
    const newLabels = latestData.map(item => new Date(item.created_at).toLocaleString()).reverse();
    const newDatasets = historicalData.datasets.map((dataset) => {
      const param = dataset.label;
      const newData = latestData.map(item => item[param]).reverse();
      return { ...dataset, data: newData };
    });

    setHistoricalData({
      labels: newLabels,
      datasets: newDatasets
    });
  };

  const handleDeviceChange = (value) => {
    setSelectedDevice(value);
  };

  const downloadCSV = () => {
    const headers = ['id', 'created_at', 'device_name', 'lat', 'lng', 'x', 'y', 'press', 'water_level', 'rain', 'batt'];
    const csvContent = [
      headers.join(','),
      ...airQualityData.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'air_quality_data.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isWithinTolerance = (lat1, lon1, lat2, lon2, tolerance = 5) => {
    const point1 = turf.point([lon1, lat1]); 
    const point2 = turf.point([lon2, lat2]);
    return turf.distance(point1, point2, { units: 'meters' }) <= tolerance;
  };

  const getUniqueMarkers = (data) => {
    const uniqueMarkers = [];
    data.forEach(item => {
      const existingMarker = uniqueMarkers.find(marker => isWithinTolerance(marker.lat, marker.lng, item.lat, item.lng));
      if (!existingMarker) {
        uniqueMarkers.push(item);
      }
    });
    return uniqueMarkers;
  };

  // Debug log untuk melihat deviceNames
  console.log('Device Names:', deviceNames);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8">
      <div className="container mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold text-center mb-8">ModAthus Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Real-time ModAthus Map</CardTitle>
            </CardHeader>
            <CardContent>
              <MapContainer center={YKCoordinates} zoom={20} className="h-[400px] w-full">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"           
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {getUniqueMarkers(airQualityData).map((data) => (
                  <CircleMarker key={data.id} center={[data.lat, data.lng]} radius={5} fillColor="blue" color="blue" fillOpacity={0.1}>
                    <Popup>
                      <div>
                        <strong>{data.device_name}</strong><br />
                        X: {data.x}<br />
                        Y: {data.y}<br />
                        Pressure: {data.press}<br />
                        Water Level: {data.water_level}<br />
                        Rain: {data.rain}<br />
                        Battery: {data.batt}<br />
                        Time: {new Date(data.created_at).toLocaleString('en-US', {
                          hour: 'numeric',
                          minute: 'numeric',
                          second: 'numeric',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}<br />
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Historical ModAthus Data</CardTitle>
                <Select value={selectedDevice} onValueChange={handleDeviceChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    {deviceNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {historicalData.labels.length > 0 && (
                <div className="h-[400px] w-full">
                  <Line
                    data={historicalData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                      },
                      scales: {
                        x: {
                          grid: {
                            display: false,
                          },
                        },
                        y: {
                          grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                          },
                        },
                      },
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Log ModAthus Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead onClick={() => handleSort('created_at')}>Timestamp</TableHead>
                      <TableHead onClick={() => handleSort('device_name')}>Device Name</TableHead>
                      <TableHead onClick={() => handleSort('lat')}>Latitude</TableHead>
                      <TableHead onClick={() => handleSort('lng')}>Longitude</TableHead>
                      <TableHead onClick={() => handleSort('x')}>X</TableHead>
                      <TableHead onClick={() => handleSort('y')}>Y</TableHead>
                      <TableHead onClick={() => handleSort('press')}>Pressure</TableHead>
                      <TableHead onClick={() => handleSort('batt')}>Battery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.created_at).toLocaleString('en-US', {
                          hour: 'numeric',
                          minute: 'numeric',
                          second: 'numeric',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}</TableCell>
                        <TableCell>{row.device_name}</TableCell>
                        <TableCell>{row.lat}</TableCell>
                        <TableCell>{row.lng}</TableCell>
                        <TableCell>{row.x}</TableCell>
                        <TableCell>{row.y}</TableCell>
                        <TableCell>{row.press}</TableCell>
                        <TableCell>{row.batt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center mt-8">
          <Button onClick={downloadCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>
    </div>
  );
};

export default App;

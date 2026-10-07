-- Матрица {a,b,c,d,tx,ty}: x'=a*x+c*y+tx, y'=b*x+d*y+ty.
local A = {}
function A.identity() return {1,0,0,1,0,0} end
function A.point(m,x,y)
    if not m then return x,y end
    return m[1]*x+m[3]*y+m[5], m[2]*x+m[4]*y+m[6]
end
function A.multiply(a,b)
    a = a or A.identity()
    return {a[1]*b[1]+a[3]*b[2], a[2]*b[1]+a[4]*b[2],
        a[1]*b[3]+a[3]*b[4], a[2]*b[3]+a[4]*b[4],
        a[1]*b[5]+a[3]*b[6]+a[5], a[2]*b[5]+a[4]*b[6]+a[6]}
end
function A.inverse(m)
    if not m then return A.identity() end
    local d = m[1]*m[4]-m[2]*m[3]
    if math.abs(d)<1e-12 then return nil end
    return {m[4]/d,-m[2]/d,-m[3]/d,m[1]/d,
        (m[3]*m[6]-m[4]*m[5])/d,(m[2]*m[5]-m[1]*m[6])/d}
end
function A.around(a,b,c,d,x,y)
    return {a,b,c,d,x-a*x-c*y,y-b*x-d*y}
end
function A.bounds(m,x,y,w,h)
    local x0,y0 = A.point(m,x,y)
    local x1,y1 = A.point(m,x+w,y)
    local x2,y2 = A.point(m,x,y+h)
    local x3,y3 = A.point(m,x+w,y+h)
    return math.min(x0,x1,x2,x3),math.min(y0,y1,y2,y3),
        math.max(x0,x1,x2,x3),math.max(y0,y1,y2,y3)
end
function A.contains(inv,x,y,rx,ry,w,h)
    if not inv then return false end
    x,y = A.point(inv,x,y)
    return x>=rx and y>=ry and x<rx+w and y<ry+h
end
return A

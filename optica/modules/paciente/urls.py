from django.urls import path
from .views import pacienteListView, addPacienteView, editPacienteView, deletePacienteView

app_name = 'pacientes'

urlpatterns = [
    path('',pacienteListView.as_view(),name="list"),
    path('add/',addPacienteView.as_view(),name="create"),
    path('editar/<int:pk>/',editPacienteView.as_view(),name="edit"),
    path('eliminar/<int:pk>/',deletePacienteView.as_view(),name="delete"),
]
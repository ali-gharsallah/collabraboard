#include<stdlib.h>
#include<clutter/clutter.h>

//using namespace std;

static gboolean on_stage_button_press(ClutterStage *stage, ClutterEvent *event, gpointer data) {
	gint x = 0;
	gint y = 0;
	clutter_event_get_coords (event, &x, &y);

	g_print("Stage clicked at (%d, %d)\n", x, y);

	return TRUE; /* Stop further handling of this event */
}

int main(int argc, char *argv[]) {
	clutter_init(&argc, &argv);

	ClutterColor stage_color = { 0x00, 0x00, 0x00, 0xff }; /* Black */
	ClutterColor actor_color = { 0xff, 0xff, 0xff, 0x99 }; /* Gray */

	ClutterActor *stage = clutter_stage_get_default ();
	clutter_actor_set_size (stage, 400, 400);
	clutter_stage_set_color (CLUTTER_STAGE (stage), &stage_color);

	ClutterActor *group = clutter_group_new ();
	clutter_actor_set_position (group, 40, 40);
	clutter_container_add_actor (CLUTTER_CONTAINER (stage), group);
	clutter_actor_show (group);

	/* Add a rectangle to the stage */
	ClutterActor *rect = clutter_rectangle_new_with_color (&actor_color);
	clutter_actor_set_size (rect, 100, 100);
	clutter_actor_set_position (rect, 20, 20);
	clutter_container_add_actor (CLUTTER_CONTAINER (group), rect);
	clutter_actor_show (rect);

	/* Add a label to the stage */
	ClutterActor *label = clutter_label_new_full ("Sans 12", "Test Text", &actor_color);
	clutter_actor_set_size (label, 500, 500);
	clutter_actor_set_position (label, 20, 150);
	clutter_container_add_actor (CLUTTER_CONTAINER (group), label);
	clutter_actor_show (label);

	/* Rotate -20 degrees about X axis (about its top edge) */
	clutter_actor_set_rotation (group, CLUTTER_Z_AXIS, 10, 0, 0, 0);

	/* Scale 300% along the x-axis */
	clutter_actor_set_scale (group, 3.00, 1.0);

	/* Show the stage */
	clutter_actor_show (stage);

	/* Connect a signal handler to handle mouse clicks and key presses on the stage: */
	g_signal_connect (stage, "button-press-event", G_CALLBACK (on_stage_button_press), NULL);

	/* Start the main loop, so we can respond to events: */
	clutter_main ();

	return EXIT_SUCCESS;
}
